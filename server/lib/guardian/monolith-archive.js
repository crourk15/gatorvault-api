/**
 * Monolith vault overlay archive — Phase 5 retirement.
 * Production index.html is the React marketing landing; vpane hooks live in legacy-index.html.
 */

const MONOLITH_ARCHIVE_HTML = 'legacy-index.html';

/** Markers that must not reappear in server/index.html after Phase 4. */
const FORBIDDEN_IN_ROOT_INDEX = [
  'id="vault-overlay"',
  'id="vault-interior"',
  'id="vpane-start"',
  'window.openVault=function',
  'function openVault(',
];

const REACT_LANDING_MARKERS = [
  'data-testid="landing-page"',
  '/_next/static/',
  'gv-marketing-main',
];

function isReactMarketingIndex(html) {
  if (!html) return false;
  return REACT_LANDING_MARKERS.some((m) => html.includes(m));
}

function isMonolithVaultIndex(html) {
  if (!html) return false;
  return html.includes('id="vault-overlay"') || html.includes('id="vpane-start"');
}

module.exports = {
  MONOLITH_ARCHIVE_HTML,
  FORBIDDEN_IN_ROOT_INDEX,
  REACT_LANDING_MARKERS,
  isReactMarketingIndex,
  isMonolithVaultIndex,
};
