/**
 * Self-Runner 2.0 — canonical CSS design tokens for Team Identity theme.
 */

const REQUIRED_TOKENS = {
  '--gv-team-card-bg': '#121c2e',
  '--gv-team-card-border': 'rgba(0, 48, 135, 0.4)',
  '--gv-team-radius': '14px',
  '--gv-team-space-4': '16px',
  '--gv-team-title': 'clamp(1.75rem, 4vw, 2.5rem)',
  '--gv-team-body': '0.875rem',
  '--gv-team-h2': 'clamp(1.125rem, 2.5vw, 1.375rem)',
  '--gv-team-h3': '0.6875rem'
};

const ERA_GRADIENT_CLASSES = [
  'gv-team-era-70s80s',
  'gv-team-era-90s',
  'gv-team-era-2000s',
  'gv-team-era-2010s',
  'gv-team-era-2020s'
];

const THEME_FILES = ['css/gv-team.css'];

const MODAL_OVERFLOW_RULES = `.gv-team-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-wrap: break-word;
}
.gv-tm-lead, .gv-tm-body, .gv-tm-highlight-text, .gv-tm-timeline-item {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: break-word;
  word-break: break-word;
}
.gv-team-overview-main { min-width: 0; }`;

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
