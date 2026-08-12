import {
  DAILY_FOLLOWUP_PROTOCOL_VERSION,
  REVIEW_REASONS,
  REVIEW_TYPES,
  WEEKLY_REVIEW_MAX_ITEMS,
  WEEKLY_REVIEW_PROTOCOL_VERSION,
  buildDailyFollowUpPlan,
  buildReviewRunSummary,
  buildWeeklyReviewCycle,
  buildWeeklyReviewPlan,
  classifyDailyFollowUpOutcome,
  classifyWeeklyReviewOutcome,
  deterministicReviewOrder,
  evaluateReviewAnswer,
  formatReviewDelay,
  qualifyDailyFollowUpOpportunity,
  qualifyWeeklyReviewOpportunity,
  reviewHelpText,
  sanitizeReviewItem,
  selectDailyFollowUpAnchors,
  selectWeeklyReviewAnchors,
} from './followUps.js';
import { ITEM_IDENTITY_VERSION } from './identity.js';
import {
  RETENTION_OUTCOMES,
  RETENTION_QUALIFICATION_STATUSES,
  RETENTION_REASONS,
} from './retention.js';

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeFollowUpSettings(learner = {}) {
  return {
    daily_followups_enabled: learner.daily_followups_enabled === true,
    weekly_reviews_enabled: learner.weekly_reviews_enabled === true,
    weekly_review_day: String(learner.weekly_review_day || 'friday').toLowerCase(),
  };
}

function runEnabled(run, settings) {
  return run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP
    ? settings.daily_followups_enabled
    : settings.weekly_reviews_enabled;
}

function groupBy(rows, keyName) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row?.[keyName] || '');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function resultEvents(events) {
  return (events || []).filter((event) => event.event_type === 'review_item_result');
}

function presentedEvents(events) {
  return (events || []).filter((event) => event.event_type === 'item_presented');
}

function exposedIdentityKeys({ evidenceEvents = [], reviewItems = [], reviewEvents = [], excludeReviewItemId = null } = {}) {
  const keys = new Set();
  for (const event of evidenceEvents || []) {
    if (event.event_type !== 'item_presented') continue;
    if (event.stable_item_id) keys.add(`stable:${event.stable_item_id}`);
    if (event.item_content_hash) keys.add(`content:${event.item_content_hash}`);
  }
  const presentedItemIds = new Set(presentedEvents(reviewEvents)
    .map((event) => String(event.review_item_id))
    .filter((id) => id && id !== String(excludeReviewItemId || '')));
  for (const item of reviewItems || []) {
    if (!presentedItemIds.has(String(item.id))) continue;
    if (item.stable_item_id) keys.add(`stable:${item.stable_item_id}`);
    if (item.item_content_hash) keys.add(`content:${item.item_content_hash}`);
  }
  return keys;
}

async function loadReviewHistory({ repository, userId, learnerId }) {
  const runs = await repository.listReviewRuns({ userId, learnerId });
  const runIds = runs.map((run) => run.id);
  const [items, events] = await Promise.all([
    repository.listReviewItems({ userId, learnerId, runIds }),
    repository.listReviewEvents({ userId, learnerId, runIds }),
  ]);
  return { runs, items, events };
}

function buildReviewResultContext(history) {
  const runById = new Map(history.runs.map((run) => [String(run.id), run]));
  const itemById = new Map(history.items.map((item) => [String(item.id), item]));
  return resultEvents(history.events).map((event) => {
    const run = runById.get(String(event.run_id));
    const item = itemById.get(String(event.review_item_id));
    return {
      ...event,
      review_type: run?.review_type || event?.metadata?.review_type || null,
      anchor_mastery_check_id: item?.anchor_mastery_check_id
        || event?.metadata?.anchor_mastery_check_id
        || null,
      lesson_key: item?.lesson_key || null,
      concept_id: item?.concept_id || null,
    };
  });
}

function pendingRunCard(run, items, events) {
  const completed = new Set(resultEvents(events).map((event) => String(event.review_item_id)));
  const pendingItems = items.filter((item) => !completed.has(String(item.id)));
  if (!pendingItems.length) return null;
  const title = run.metadata?.title || pendingItems[0]?.lesson_id || 'Follow-Up';
  return {
    id: `${run.review_type}:${run.id}`,
    review_type: run.review_type,
    run_id: run.id,
    cycle_key: run.cycle_key,
    title: run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP ? `Remember ${title}?` : 'A quick weekly review',
    subtitle: run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP
      ? 'A quick check from your last lesson'
      : 'See what you remember from recent lessons',
    item_count: items.length,
    remaining_count: pendingItems.length,
    resume: presentedEvents(events).length > 0,
  };
}

export async function buildFollowUpAvailability({
  repository,
  userId,
  learnerId,
  loadLesson,
  now = new Date().toISOString(),
  includePrivate = false,
} = {}) {
  const learner = await repository.findOwnedLearner({ userId, learnerId });
  if (!learner?.id) return { kind: 'forbidden' };
  const settings = normalizeFollowUpSettings(learner);
  const timezone = (await repository.getProfileTimezone({ userId })) || 'UTC';
  const cycle = buildWeeklyReviewCycle({
    now,
    weekday: settings.weekly_review_day,
    timeZone: timezone,
  });
  if (!settings.daily_followups_enabled && !settings.weekly_reviews_enabled) {
    return { kind: 'ok', settings, timezone: cycle.timeZone, cycle, cards: [] };
  }

  const [evidenceEvents, history] = await Promise.all([
    repository.listEvidenceEvents({ userId, learnerId }),
    loadReviewHistory({ repository, userId, learnerId }),
  ]);
  const itemsByRun = groupBy(history.items, 'run_id');
  const eventsByRun = groupBy(history.events, 'run_id');
  const reviewResults = buildReviewResultContext(history);
  const exposedKeys = exposedIdentityKeys({
    evidenceEvents,
    reviewItems: history.items,
    reviewEvents: history.events,
  });
  const cards = [];

  if (settings.daily_followups_enabled) {
    const activeDailyRuns = history.runs.filter((run) => (
      run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP && run.status === 'active'
    ));
    const activeCycles = new Set();
    for (const run of activeDailyRuns) {
      const card = pendingRunCard(
        run,
        itemsByRun.get(String(run.id)) || [],
        eventsByRun.get(String(run.id)) || [],
      );
      if (card) {
        activeCycles.add(run.cycle_key);
        cards.push(card);
      }
    }

    const anchors = selectDailyFollowUpAnchors({ evidenceEvents, reviewResultEvents: reviewResults, now });
    for (const anchor of anchors) {
      const cycleKey = `daily:${anchor.mastery_check_id}`;
      if (activeCycles.has(cycleKey)) continue;
      const lesson = await loadLesson(anchor.lesson_key);
      if (!lesson) continue;
      const plan = await buildDailyFollowUpPlan({
        lessonKey: anchor.lesson_key,
        lessonId: anchor.lesson_id,
        lessonData: lesson,
        priorExposedKeys: exposedKeys,
      });
      if (!plan.eligible) continue;
      const selection = {
        anchor,
        lesson,
        item: plan.selectedItems[0],
        identity: plan.selectedIdentities[0],
      };
      const card = {
        id: cycleKey,
        review_type: REVIEW_TYPES.DAILY_FOLLOWUP,
        run_id: null,
        cycle_key: cycleKey,
        title: `Remember ${lesson.title || anchor.lesson_id || 'this lesson'}?`,
        subtitle: 'A quick check from your last lesson',
        item_count: 1,
        remaining_count: 1,
        resume: false,
      };
      if (includePrivate) {
        card._selections = [selection];
        card._cycle = cycle;
      }
      cards.push(card);
    }
  }

  if (settings.weekly_reviews_enabled && cycle.active) {
    const currentRun = history.runs.find((run) => (
      run.review_type === REVIEW_TYPES.WEEKLY_REVIEW
      && run.cycle_key === cycle.cycleKey
      && run.status === 'active'
    ));
    if (currentRun) {
      const card = pendingRunCard(
        currentRun,
        itemsByRun.get(String(currentRun.id)) || [],
        eventsByRun.get(String(currentRun.id)) || [],
      );
      if (card) cards.unshift(card);
    } else {
      const anchors = await deterministicReviewOrder(
        selectWeeklyReviewAnchors({ evidenceEvents, cycle }),
        cycle.cycleKey,
      );
      const selections = [];
      const selectionKeys = new Set(exposedKeys);
      for (const anchor of anchors) {
        if (selections.length >= WEEKLY_REVIEW_MAX_ITEMS) break;
        const lesson = await loadLesson(anchor.lesson_key);
        if (!lesson) continue;
        const plan = await buildWeeklyReviewPlan({
          lessonKey: anchor.lesson_key,
          lessonId: anchor.lesson_id,
          lessonData: lesson,
          priorExposedKeys: selectionKeys,
        });
        if (!plan.eligible) continue;
        const item = plan.selectedItems[0];
        const identity = plan.selectedIdentities[0];
        selections.push({ anchor, lesson, item, identity });
        selectionKeys.add(`stable:${identity.stableItemId}`);
        selectionKeys.add(`content:${identity.itemContentHash}`);
      }
      if (selections.length) {
        const card = {
          id: `weekly:${cycle.cycleKey}`,
          review_type: REVIEW_TYPES.WEEKLY_REVIEW,
          run_id: null,
          cycle_key: cycle.cycleKey,
          title: 'A quick weekly review',
          subtitle: 'See what you remember from recent lessons',
          item_count: selections.length,
          remaining_count: selections.length,
          resume: false,
        };
        if (includePrivate) {
          card._selections = selections;
          card._cycle = cycle;
        }
        cards.unshift(card);
      }
    }
  }

  return { kind: 'ok', settings, timezone: cycle.timeZone, cycle, cards };
}

export function publicAvailability(result) {
  if (!result || result.kind !== 'ok') return result;
  return {
    ...result,
    cards: result.cards.map(({ _selections, ...card }) => card),
  };
}

export async function startFollowUpRun({
  repository,
  userId,
  learnerId,
  card,
  now = new Date().toISOString(),
} = {}) {
  if (card.run_id) return repository.getRun({ userId, runId: card.run_id });
  const selections = card._selections || [];
  if (!selections.length) throw new Error('Review selection is unavailable');
  const runId = randomId();
  const isDaily = card.review_type === REVIEW_TYPES.DAILY_FOLLOWUP;
  const firstSelection = selections[0];
  const runRow = {
    id: runId,
    facilitator_id: userId,
    learner_id: learnerId,
    review_type: card.review_type,
    protocol_version: isDaily ? DAILY_FOLLOWUP_PROTOCOL_VERSION : WEEKLY_REVIEW_PROTOCOL_VERSION,
    cycle_key: card.cycle_key,
    status: 'active',
    timezone: card._cycle?.timeZone || 'UTC',
    activation_at: isDaily
      ? new Date(Date.parse(firstSelection.anchor.occurred_at) + (24 * 60 * 60 * 1000)).toISOString()
      : card._cycle?.activationAt || now,
    window_start: isDaily ? null : card._cycle?.windowStart || null,
    window_end: isDaily ? null : card._cycle?.windowEnd || null,
    metadata: {
      title: isDaily
        ? (firstSelection.lesson.title || firstSelection.anchor.lesson_id || 'this lesson')
        : 'Weekly Review',
      item_count: selections.length,
    },
    started_at: now,
    updated_at: now,
  };

  let run;
  try {
    run = await repository.insertRun(runRow);
  } catch (error) {
    if (error?.code !== '23505') throw error;
    run = await repository.findRunByCycle({
      learnerId,
      reviewType: card.review_type,
      cycleKey: card.cycle_key,
    });
  }
  if (!run?.id) throw new Error('Review run could not be created');

  const existingItems = await repository.listReviewItems({ userId, learnerId, runIds: [run.id] });
  if (!existingItems.length) {
    try {
      await repository.insertItems(selections.map((selection, ordinal) => {
        const itemId = randomId();
        return {
          id: itemId,
          run_id: run.id,
          facilitator_id: userId,
          learner_id: learnerId,
          ordinal,
          lesson_key: selection.anchor.lesson_key,
          lesson_id: selection.anchor.lesson_id || selection.lesson.id || null,
          lesson_version_id: null,
          anchor_mastery_check_id: selection.anchor.mastery_check_id,
          anchor_occurred_at: selection.anchor.occurred_at,
          concept_id: selection.anchor.concept_id || selection.identity.conceptId || null,
          stable_item_id: selection.identity.stableItemId,
          item_content_hash: selection.identity.itemContentHash,
          item_identity_version: selection.identity.itemIdentityVersion || ITEM_IDENTITY_VERSION,
          item_exposure_id: `review-exposure:${itemId}`,
          item_payload: selection.item,
        };
      }));
    } catch (error) {
      if (error?.code !== '23505') throw error;
    }
  }
  return run;
}

export async function loadFollowUpRunState({ repository, userId, runId } = {}) {
  const run = await repository.getRun({ userId, runId });
  if (!run?.id) return { kind: 'not_found' };
  const learner = await repository.findOwnedLearner({ userId, learnerId: run.learner_id });
  if (!learner?.id) return { kind: 'forbidden' };
  const [items, events] = await Promise.all([
    repository.listReviewItems({ userId, learnerId: run.learner_id, runIds: [run.id] }),
    repository.listReviewEvents({ userId, learnerId: run.learner_id, runIds: [run.id] }),
  ]);
  const results = new Map(resultEvents(events).map((event) => [String(event.review_item_id), event]));
  const currentItem = items.find((item) => !results.has(String(item.id))) || null;
  const presented = currentItem
    ? presentedEvents(events).some((event) => String(event.review_item_id) === String(currentItem.id))
    : false;
  const settings = normalizeFollowUpSettings(learner);
  return {
    kind: 'ok',
    run,
    learner,
    settings,
    items,
    events,
    currentItem,
    presented,
    enabled: runEnabled(run, settings),
    complete: !currentItem,
    summary: buildReviewRunSummary({ run, items, events }),
  };
}

export function publicRunState(state) {
  if (!state || state.kind !== 'ok') return state;
  const resultCount = resultEvents(state.events).length;
  return {
    kind: 'ok',
    enabled: state.enabled,
    complete: state.complete,
    run: {
      id: state.run.id,
      review_type: state.run.review_type,
      protocol_version: state.run.protocol_version,
      status: state.run.status,
    },
    progress: {
      completed: resultCount,
      total: state.items.length,
    },
    current_item: state.currentItem ? {
      id: state.currentItem.id,
      presented: state.presented,
      lesson_key: state.currentItem.lesson_key,
      content: sanitizeReviewItem(state.currentItem.item_payload),
    } : null,
    summary: state.summary,
  };
}

function instructionAfterAnchor(evidenceEvents, anchor, until) {
  const anchorTime = Date.parse(anchor?.occurred_at || '');
  const untilTime = Date.parse(until || '');
  return (evidenceEvents || []).some((event) => {
    if (event.event_type !== 'item_presented') return false;
    const occurred = Date.parse(event.occurred_at || '');
    if (!Number.isFinite(occurred) || occurred <= anchorTime || occurred > untilTime) return false;
    const instructional = event.assessment_role === 'instructional'
      || ['discussion', 'comprehension', 'exercise', 'worksheet'].includes(event.phase);
    if (!instructional) return false;
    return anchor.concept_id ? event.concept_id === anchor.concept_id : event.lesson_key === anchor.lesson_key;
  });
}

export async function presentFollowUpItem({ repository, userId, runId, itemId, now = new Date().toISOString() } = {}) {
  const state = await loadFollowUpRunState({ repository, userId, runId });
  if (state.kind !== 'ok') return state;
  if (!state.currentItem || String(state.currentItem.id) !== String(itemId)) return { kind: 'conflict', reason: 'item_not_current' };
  if (state.presented) return state;
  if (!state.enabled) return { kind: 'disabled' };

  const [evidenceEvents, history] = await Promise.all([
    repository.listEvidenceEvents({ userId, learnerId: state.run.learner_id }),
    loadReviewHistory({ repository, userId, learnerId: state.run.learner_id }),
  ]);
  const priorKeys = exposedIdentityKeys({
    evidenceEvents,
    reviewItems: history.items,
    reviewEvents: history.events,
    excludeReviewItemId: state.currentItem.id,
  });
  if (priorKeys.has(`stable:${state.currentItem.stable_item_id}`)
    || priorKeys.has(`content:${state.currentItem.item_content_hash}`)) {
    return { kind: 'conflict', reason: REVIEW_REASONS.PRIOR_EXPOSURE };
  }

  await repository.insertEvent({
    run_id: state.run.id,
    review_item_id: state.currentItem.id,
    facilitator_id: userId,
    learner_id: state.run.learner_id,
    event_type: 'item_presented',
    idempotency_key: `review-presented:${state.currentItem.id}`,
    occurred_at: now,
    metadata: {
      review_type: state.run.review_type,
      protocol_version: state.run.protocol_version,
      anchor_mastery_check_id: state.currentItem.anchor_mastery_check_id,
    },
  });
  return loadFollowUpRunState({ repository, userId, runId });
}

export async function recordFollowUpAssistance({
  repository,
  userId,
  runId,
  itemId,
  kind,
  requestId = null,
  now = new Date().toISOString(),
} = {}) {
  const state = await loadFollowUpRunState({ repository, userId, runId });
  if (state.kind !== 'ok') return state;
  if (!state.currentItem || String(state.currentItem.id) !== String(itemId) || !state.presented) {
    return { kind: 'conflict', reason: 'item_not_presented' };
  }
  if (resultEvents(state.events).some((event) => String(event.review_item_id) === String(itemId))) {
    return { kind: 'conflict', reason: 'first_response_already_recorded' };
  }
  const allowed = {
    repeat: { event_type: 'repeat_used', assistance_level: null },
    hint: { event_type: 'hint_given', assistance_level: 'hinted' },
    answer_reveal: { event_type: 'answer_revealed', assistance_level: 'answer_revealed' },
  }[kind];
  if (!allowed) return { kind: 'invalid', reason: 'unsupported_assistance' };
  await repository.insertEvent({
    run_id: state.run.id,
    review_item_id: state.currentItem.id,
    facilitator_id: userId,
    learner_id: state.run.learner_id,
    event_type: allowed.event_type,
    idempotency_key: `review-assistance:${state.currentItem.id}:${allowed.event_type}:${requestId || randomId()}`,
    occurred_at: now,
    assistance_level: allowed.assistance_level,
    metadata: { review_type: state.run.review_type },
  });
  return {
    kind: 'ok',
    help_text: kind === 'repeat'
      ? sanitizeReviewItem(state.currentItem.item_payload).question
      : reviewHelpText(state.currentItem.item_payload),
  };
}

export async function respondToFollowUpItem({
  repository,
  userId,
  runId,
  itemId,
  response,
  now = new Date().toISOString(),
} = {}) {
  let state = await loadFollowUpRunState({ repository, userId, runId });
  if (state.kind !== 'ok') return state;
  if (!state.currentItem || String(state.currentItem.id) !== String(itemId) || !state.presented) {
    return { kind: 'conflict', reason: 'item_not_presented' };
  }
  const existingResult = resultEvents(state.events)
    .find((event) => String(event.review_item_id) === String(itemId));
  if (existingResult) return { kind: 'ok', duplicate: true, result: existingResult, state };

  const existingResponse = state.events.find((event) => (
    event.event_type === 'learner_response' && String(event.review_item_id) === String(itemId)
  ));
  let firstResponse = existingResponse?.response_text ?? String(response ?? '').trim();
  if (!firstResponse) return { kind: 'invalid', reason: 'response_required' };

  let persistedResponse = existingResponse || null;
  if (!existingResponse) {
    persistedResponse = await repository.insertEvent({
      run_id: state.run.id,
      review_item_id: state.currentItem.id,
      facilitator_id: userId,
      learner_id: state.run.learner_id,
      event_type: 'learner_response',
      idempotency_key: `review-response:${state.currentItem.id}`,
      occurred_at: now,
      response_text: firstResponse,
      is_first_response: true,
      metadata: { review_type: state.run.review_type },
    });
    firstResponse = persistedResponse?.response_text ?? firstResponse;
  }

  state = await loadFollowUpRunState({ repository, userId, runId });
  if (state.kind !== 'ok') return state;

  const [evidenceEvents, history] = await Promise.all([
    repository.listEvidenceEvents({ userId, learnerId: state.run.learner_id }),
    loadReviewHistory({ repository, userId, learnerId: state.run.learner_id }),
  ]);
  const anchor = evidenceEvents.find((event) => (
    event.event_type === 'mastery_check_result'
    && event.mastery_check_id === state.currentItem.anchor_mastery_check_id
  )) || null;
  const presented = state.events.find((event) => (
    event.event_type === 'item_presented' && String(event.review_item_id) === String(itemId)
  ));
  const presentedAt = presented?.occurred_at || now;
  const delaySeconds = Math.max(0, Math.floor((Date.parse(presentedAt) - Date.parse(anchor?.occurred_at || presentedAt)) / 1000));
  const responseAt = persistedResponse?.occurred_at || now;
  const assistance = state.events.filter((event) => (
    String(event.review_item_id) === String(itemId)
    && ['hint_given', 'answer_revealed', 'repeat_used'].includes(event.event_type)
    && Date.parse(event.occurred_at || 0) <= Date.parse(responseAt)
  ));
  const priorKeys = exposedIdentityKeys({
    evidenceEvents,
    reviewItems: history.items,
    reviewEvents: history.events,
    excludeReviewItemId: itemId,
  });
  const itemIdentity = {
    stableItemId: state.currentItem.stable_item_id,
    itemContentHash: state.currentItem.item_content_hash,
  };
  const isCorrect = evaluateReviewAnswer(state.currentItem.item_payload, firstResponse);
  const interveningInstruction = instructionAfterAnchor(evidenceEvents, anchor, presentedAt);
  const reviewContext = buildReviewResultContext(history);
  const earlierSameAnchorReviews = reviewContext.filter((event) => (
    event.anchor_mastery_check_id === state.currentItem.anchor_mastery_check_id
  ));
  const priorDaily = earlierSameAnchorReviews.some((event) => event.review_type === REVIEW_TYPES.DAILY_FOLLOWUP);
  const legacyRetention = evidenceEvents.some((event) => (
    event.event_type === 'retention_check_result'
    && event.retention_anchor_mastery_check_id === state.currentItem.anchor_mastery_check_id
    && Date.parse(event.occurred_at || 0) < Date.parse(presentedAt)
  ));

  let qualification;
  let outcome;
  if (state.run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP) {
    qualification = qualifyDailyFollowUpOpportunity({
      anchor,
      delaySeconds,
      itemIdentity,
      itemExposureId: state.currentItem.item_exposure_id,
      isFirstResponse: true,
      priorExposedKeys: priorKeys,
      assistanceEventsBeforeResponse: assistance,
      interveningSameTargetInstruction: interveningInstruction,
    });
    outcome = classifyDailyFollowUpOutcome({ qualification, isCorrect });
  } else {
    qualification = qualifyWeeklyReviewOpportunity({
      anchor,
      itemIdentity,
      itemExposureId: state.currentItem.item_exposure_id,
      isFirstResponse: true,
      priorExposedKeys: priorKeys,
      assistanceEventsBeforeResponse: assistance,
    });
    outcome = classifyWeeklyReviewOutcome({ qualification, isCorrect });
  }

  const qualificationStatus = qualification.retentionQualificationStatus
    || qualification.qualificationStatus
    || RETENTION_QUALIFICATION_STATUSES.UNAVAILABLE;
  const qualificationReason = qualification.retentionQualificationReason
    || qualification.qualificationReason
    || REVIEW_REASONS.EVIDENCE_UNAVAILABLE;
  await repository.insertEvent({
    run_id: state.run.id,
    review_item_id: state.currentItem.id,
    facilitator_id: userId,
    learner_id: state.run.learner_id,
    event_type: 'answer_evaluated',
    idempotency_key: `review-evaluated:${state.currentItem.id}`,
    occurred_at: now,
    is_first_response: true,
    result: { correct: isCorrect },
    metadata: { review_type: state.run.review_type },
  });
  const result = await repository.insertEvent({
    run_id: state.run.id,
    review_item_id: state.currentItem.id,
    facilitator_id: userId,
    learner_id: state.run.learner_id,
    event_type: 'review_item_result',
    idempotency_key: `review-result:${state.currentItem.id}`,
    occurred_at: now,
    is_first_response: true,
    result: { correct: isCorrect },
    qualification_status: qualificationStatus,
    qualification_reason: qualificationReason,
    review_outcome: outcome,
    delay_seconds: delaySeconds,
    prior_daily_retrieval_observed: priorDaily,
    intervening_instruction_observed: interveningInstruction,
    intervening_review_observed: priorDaily || legacyRetention || earlierSameAnchorReviews.length > 0,
    metadata: {
      review_type: state.run.review_type,
      protocol_version: state.run.protocol_version,
      anchor_mastery_check_id: state.currentItem.anchor_mastery_check_id,
      independence_status: qualification.independenceStatus || qualification.independence_status || null,
      independence_reason: qualification.independenceReason || qualification.independence_reason || null,
    },
  });

  const existingResultCount = resultEvents(state.events).length;
  const completed = existingResultCount + 1 >= state.items.length;
  if (completed) {
    await repository.updateRun({
      runId: state.run.id,
      updates: { status: 'completed', completed_at: now },
    });
  }
  state = await loadFollowUpRunState({ repository, userId, runId });
  const isDaily = state.run.review_type === REVIEW_TYPES.DAILY_FOLLOWUP;
  const retained = outcome === RETENTION_OUTCOMES.RETAINED;
  const demonstrated = outcome === 'demonstrated';
  return {
    kind: 'ok',
    duplicate: false,
    result,
    state,
    acknowledgement: isCorrect
      ? (isDaily && retained
        ? `You remembered it after ${formatReviewDelay(delaySeconds)}.`
        : (demonstrated ? 'Nice work bringing that idea back.' : 'Nice work checking what you remember.'))
      : 'Thanks for giving it a try. This one is ready for a quick review.',
    review_recommended: !isCorrect || outcome === RETENTION_OUTCOMES.NEEDS_REVIEW,
  };
}

export function attachCycleToWeeklyCard(availability) {
  if (availability?.kind !== 'ok') return availability;
  for (const card of availability.cards || []) {
    if (card.review_type === REVIEW_TYPES.WEEKLY_REVIEW && !card.run_id) {
      card._cycle = availability.cycle;
    }
  }
  return availability;
}

export function unavailableDailyResultReason(qualification) {
  return qualification?.retentionQualificationReason
    || RETENTION_REASONS.EVIDENCE_UNAVAILABLE;
}
