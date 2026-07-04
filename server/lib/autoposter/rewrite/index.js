/** PR-6/7/8/9 rewrite layer — public exports. */

const rewriteEngine = require('./rewrite-engine');
const {
  CHAR_LIMIT,
  MAX_REWRITE_ATTEMPTS,
  GENERIC_BANNED,
  MECHANICAL_BANNED,
  INSIDER_VOCAB,
  isPr6ShadowMode,
  isPr6Enabled,
  isPr789ShadowMode,
  isPr789Enabled,
  isPr789AngleShadowMode,
  isPr789AngleEnabled
} = require('./rewrite-types');
const {
  isPr6GoldenBeat,
  shouldUsePr6Live,
  shouldUsePr789Live,
  shouldUsePr789AngleLive,
  PR6_SOFT_LAUNCH_SLUGS,
  resolveGoldenBeatId
} = require('./golden-beats');
const sentenceGate = require('./sentence-gate');
const toneEngine = require('./tone-engine');
const narrativeGate = require('./narrative-gate');
const provenanceGate = require('./provenance-gate');
const rewriteTrace = require('./rewrite-trace');
const competitionEngine = require('./competition-engine');
const trajectoryEngine = require('./trajectory-engine');
const brandvoiceEngine = require('./brandvoice-engine');
const enhanceEngine = require('./enhance-engine');
const angleEnhanceEngine = require('./angle-enhance-engine');
const angleEngine = require('./angle-engine');

module.exports = {
  ...rewriteEngine,
  CHAR_LIMIT,
  MAX_REWRITE_ATTEMPTS,
  GENERIC_BANNED,
  MECHANICAL_BANNED,
  INSIDER_VOCAB,
  isPr6ShadowMode,
  isPr6Enabled,
  isPr789ShadowMode,
  isPr789Enabled,
  isPr789AngleShadowMode,
  isPr789AngleEnabled,
  isPr6GoldenBeat,
  shouldUsePr6Live,
  shouldUsePr789Live,
  shouldUsePr789AngleLive,
  PR6_SOFT_LAUNCH_SLUGS,
  resolveGoldenBeatId,
  ...sentenceGate,
  ...toneEngine,
  ...narrativeGate,
  ...provenanceGate,
  ...rewriteTrace,
  ...competitionEngine,
  ...trajectoryEngine,
  ...brandvoiceEngine,
  ...enhanceEngine,
  ...angleEnhanceEngine,
  ...angleEngine
};
