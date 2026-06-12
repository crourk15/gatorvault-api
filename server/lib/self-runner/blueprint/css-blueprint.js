/**
 * Self-Runner 3.0 — CSS tokens loaded from blueprints/css-tokens.json
 */
const loader = require('./blueprint-loader');

function loadTokens() {
  return loader.requiredCssTokens();
}

const REQUIRED_TOKENS = loadTokens();
const bp = loader.cssBlueprint();
const ERA_GRADIENT_CLASSES = bp.eraGradientClasses || [];
const THEME_FILES = bp.files || ['css/gv-team.css'];
const MODAL_OVERFLOW_RULES = bp.modalOverflowRules || '';

function tokensBlock(missingTokens) {
  return missingTokens.map((t) => `  ${t}: ${REQUIRED_TOKENS[t]};`).join('\n');
}

module.exports = {
  REQUIRED_TOKENS,
  ERA_GRADIENT_CLASSES,
  THEME_FILES,
  MODAL_OVERFLOW_RULES,
  tokensBlock
};
