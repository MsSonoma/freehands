// Durable, learner-acknowledged discussion objective announcements.
export function restoreDiscussionAwards(value, total = 0) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(row => {
    const index = row?.index;
    if (!Number.isInteger(index) || index < 0 || (total > 0 && index >= total) || seen.has(index)) return [];
    seen.add(index);
    return [{ index, text: String(row?.text || ''), completedCount: Number(row?.completedCount || 0), totalCount: Number(row?.totalCount || total || 0), awardedAt: Number.isFinite(row?.awardedAt) ? row.awardedAt : null }];
  });
}

export function queueDiscussionAwards(queue, indices, objectives, completedIndices) {
  const entries = restoreDiscussionAwards(queue, Array.isArray(objectives) ? objectives.length : 0);
  const seen = new Set(entries.map(item => item.index));
  const available = new Set(Array.isArray(completedIndices) ? completedIndices : []);
  const newAwards = [...new Set(Array.isArray(indices) ? indices : [])]
    .filter(index => Number.isInteger(index) && index >= 0 && index < objectives.length && available.has(index) && !seen.has(index));
  let earnedCount = available.size - newAwards.length;
  for (const index of newAwards) {
    earnedCount += 1;
    entries.push({ index, text: String(objectives[index] || ''), completedCount: earnedCount, totalCount: objectives.length, awardedAt: Date.now() });
  }
  return entries;
}

export function acknowledgeDiscussionAward(queue, index) {
  return restoreDiscussionAwards(queue).filter(item => item.index !== index);
}
