/** Phase 3 barrel — story/topic memory, ladder, evergreen, performance. */
const storyMemory = require('./story-memory');
const topicMemory = require('./topic-memory');
const researchLadder = require('./research-ladder');
const evergreenLibrary = require('./evergreen-library');
const performanceTracker = require('./performance-tracker');
function phase3Enabled() { return process.env.X_AUTOPOST_PHASE3_ENABLED !== 'false'; }
function guardCandidateMemory(c) {
  if (!phase3Enabled()) return { ok: true };
  const story = storyMemory.hasRecentStoryUnit(c);
  if (story.hit) return { ok: false, reason: 'story_dedupe', detail: story };
  const topic = topicMemory.hasRecentTopicAngle(c);
  if (topic.hit) return { ok: false, reason: 'topic_angle', detail: topic };
  return { ok: true };
}
function recordPostMemory(item) {
  if (!phase3Enabled()) return;
  try { storyMemory.recordStoryUnit(item); } catch {}
  try { topicMemory.recordTopicUsage(item); } catch {}
  try { performanceTracker.recordPostPerformance(item); } catch {}
}
module.exports = { phase3Enabled, storyMemory, topicMemory, researchLadder, evergreenLibrary, performanceTracker, guardCandidateMemory, recordPostMemory };
