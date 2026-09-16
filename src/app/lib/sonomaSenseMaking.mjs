export const SENSE_MAKING_MODES = Object.freeze({
  FIRST_EXPLANATION: 'first_explanation',
  RECOVERY_EXPLANATION: 'recovery_explanation',
  STUDY_REFRAME: 'study_reframe',
  STUDY_DEEPEN: 'study_deepen',
  HINT_SAFE: 'hint_safe',
  CONCEPTUAL_ASK: 'conceptual_ask',
});

const BASE_GUIDANCE = [
  'SENSE-MAKING CONTRACT (internal teaching guidance; do not announce or list this analysis to the learner):',
  'Before explaining an unfamiliar idea, silently consider what a novice learner could incorrectly construct from your words.',
  'Notice vocabulary that could become the obstacle, prerequisites you may be assuming, and where an abstract label could arrive before the learner has an idea to attach it to.',
  'Ground the idea in something familiar or perceivable when useful: an object, quantity, action, spatial relationship, known fact, or concrete situation.',
  'Teach the intuitive idea before depending on the formal label, then reconnect the formal term after the idea has somewhere to attach.',
  'Prefer a genuinely useful concrete model, contrast, or tiny example over replacing one abstract definition with another.',
  'Keep one main abstraction in focus at a time. Do not introduce a list of hypothetical misconceptions the learner has not expressed.',
  'If you use a contrast, make the boundary visible without telling the learner that they probably made a mistake.',
];

const MODE_GUIDANCE = Object.freeze({
  [SENSE_MAKING_MODES.FIRST_EXPLANATION]: [
    'This is the learner\'s first explanation. Prevent likely misreadings quietly in the explanation itself.',
    'Stay concise. Use only as much grounding as is needed to make the first mental model accurate.',
  ],
  [SENSE_MAKING_MODES.RECOVERY_EXPLANATION]: [
    'The prior response showed that the current explanation did not fully land.',
    'Do not merely repeat or synonym-swap the previous wording. Rebuild the idea from a clearer anchor or smaller prerequisite.',
    'Address an expressed misconception directly when one is present, without shaming or praising an incorrect idea as correct.',
  ],
  [SENSE_MAKING_MODES.STUDY_REFRAME]: [
    'The learner asked for another way to understand the same target.',
    'Change representation materially. Move to a different useful form such as a concrete example, analogy, contrast, spatial model, number model, action, or step-by-step construction.',
    'Do not merely simplify or paraphrase the previous explanation.',
  ],
  [SENSE_MAKING_MODES.STUDY_DEEPEN]: [
    'Previous attempts have not resolved the learner\'s confusion.',
    'Reduce the idea to the smallest prerequisite or intelligible piece, remove unnecessary terminology, and build upward one step at a time.',
    'You may ask one very easy, focused diagnostic question when it will locate exactly where understanding stops.',
  ],
  [SENSE_MAKING_MODES.HINT_SAFE]: [
    'This is assistance on an active practice item. Improve the learner\'s mental model without revealing the answer unless the application explicitly says the answer may be revealed.',
    'Use a nearby example, representation, or prerequisite rather than solving the current item for the learner.',
  ],
  [SENSE_MAKING_MODES.CONCEPTUAL_ASK]: [
    'Answer the learner\'s actual question directly, but use a concrete anchor or contrast when the question reveals conceptual confusion.',
    'Do not turn a simple factual question into a long lesson. Use deeper sense-making only where it helps the question make sense.',
  ],
});

export function buildSenseMakingGuidance({ mode = SENSE_MAKING_MODES.FIRST_EXPLANATION } = {}) {
  const modeLines = MODE_GUIDANCE[mode] || MODE_GUIDANCE[SENSE_MAKING_MODES.FIRST_EXPLANATION];
  return [...BASE_GUIDANCE, ...modeLines].join('\n');
}
