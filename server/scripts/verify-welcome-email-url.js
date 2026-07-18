'use strict';

const assert = require('assert');
const {
  VAULT_URL,
  VAULT_LINK_LABEL,
  VAULT_URL_DISPLAY,
  getWelcomeEmail,
} = require('../lib/onboarding-emails');

assert(
  !VAULT_URL.includes('://gatorvault.com/'),
  `VAULT_URL must not use dead gatorvault.com host: ${VAULT_URL}`
);
assert(
  VAULT_URL.includes('gatorvaultinsider.com') || process.env.GV_VAULT_URL || process.env.SITE_URL,
  `VAULT_URL should target gatorvaultinsider.com by default: ${VAULT_URL}`
);
assert(VAULT_URL.includes('/join/'), `VAULT_URL missing /join/: ${VAULT_URL}`);
assert(!VAULT_URL.includes('%2F'), `VAULT_URL should not use encoded path segments: ${VAULT_URL}`);
assert.strictEqual(VAULT_LINK_LABEL, 'Open your vault');
assert(!VAULT_URL_DISPLAY.includes('?'), `Display URL should stay short/clean: ${VAULT_URL_DISPLAY}`);

const welcome = getWelcomeEmail({ name: 'Bookhimdano', email: 'test@example.com', tier: 'film' });
assert(welcome.html.includes(VAULT_URL), 'welcome HTML must include VAULT_URL as href');
assert(welcome.html.includes(VAULT_LINK_LABEL), 'welcome HTML must show CTA label');
assert(welcome.html.includes(VAULT_URL_DISPLAY), 'welcome HTML must show clean display URL');
assert(!welcome.html.includes('%2F'), 'welcome HTML must not show encoded %2F');
assert(!welcome.html.includes('https://gatorvault.com/vault'), 'welcome HTML must not include dead vault URL');
assert.strictEqual(welcome.templateParams.vault_url, VAULT_URL);
assert.strictEqual(welcome.templateParams.vault_link_label, VAULT_LINK_LABEL);
assert.strictEqual(welcome.templateParams.vault_url_display, VAULT_URL_DISPLAY);

console.log('[verify-welcome-email-url] OK', {
  vault_url: VAULT_URL,
  vault_link_label: VAULT_LINK_LABEL,
  vault_url_display: VAULT_URL_DISPLAY,
});
