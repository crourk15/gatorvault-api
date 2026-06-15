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

/** Welcome A/B page export (canonical landing at /welcome/). */
const WELCOME_LANDING_MARKERS = [
  'app/welcome/page',
  '/_next/static/',
];

function isReactMarketingIndex(html) {
  if (!html) return false;
  return REACT_LANDING_MARKERS.some((m) => html.includes(m));
}

function isRootWelcomeRedirect(html) {
  if (!html) return false;
  return html.includes('NEXT_REDIRECT') && html.includes('/welcome');
}

function isWelcomeLandingIndex(html) {
  if (!html) return false;
  return WELCOME_LANDING_MARKERS.every((m) => html.includes(m));
}

function isMonolithVaultIndex(html) {
  if (!html) return false;
  return html.includes('id="vault-overlay"') || html.includes('id="vpane-start"');
}

module.exports = {
  MONOLITH_ARCHIVE_HTML,
  FORBIDDEN_IN_ROOT_INDEX,
  REACT_LANDING_MARKERS,
  WELCOME_LANDING_MARKERS,
  isReactMarketingIndex,
  isRootWelcomeRedirect,
  isWelcomeLandingIndex,
  isMonolithVaultIndex,
};
