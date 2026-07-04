/** PR-5 strategy engine — shared types and constants. */

const BANNED_STRATEGY_PHRASES = [
  'board priority focus',
  'visit timing tracks',
  'UF is using live campus time to test fit',
  'Gainesville activity matters here — visit timing tracks',
  'UF is in a strong position early on',
  'UF is using campus time to test fit',
  'Player-led board momentum puts UF in an active lane',
  'Staff frequency is elevated — UF is spending relationship capital'
];

const GOLDEN_OVERLAP_THRESHOLD = 0.35;
const GENERAL_OVERLAP_THRESHOLD = 0.45;
const MIN_STRATEGY_CHARS = 40;
const MAX_CONTEXT_QUOTE_CHARS = 40;

const TEMPLATE_PRIORITY = [
  'visit_board',
  'visit_staff',
  'board_staff',
  'comp_ufAngle',
  'visit_ufAngle',
  'quote_visit',
  'visit_only',
  'board_only',
  'staff_only',
  'comp_only',
  'ufAngle_only'
];

const SIGNAL_TYPES = ['visit', 'board', 'staff', 'comp', 'trait', 'quote', 'ufAngle', 'cycle'];

function strategyEngineV2Enabled() {
  return process.env.X_AUTOPOST_STRATEGY_ENGINE === 'v2';
}

module.exports = {
  BANNED_STRATEGY_PHRASES,
  GOLDEN_OVERLAP_THRESHOLD,
  GENERAL_OVERLAP_THRESHOLD,
  MIN_STRATEGY_CHARS,
  MAX_CONTEXT_QUOTE_CHARS,
  TEMPLATE_PRIORITY,
  SIGNAL_TYPES,
  strategyEngineV2Enabled
};
