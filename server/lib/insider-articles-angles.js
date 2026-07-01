/** Re-export from synthesis orchestrator */
const s = require('./insider-articles-synthesis');
module.exports = {
  typeForCategory: s.typeForCategory,
  pickNextAngle: s.pickNextAngle,
  initialAngleForTopic: (topic, ctx) => s.pickNextAngle(s.typeForCategory(topic.category), topic, ctx, []),
};