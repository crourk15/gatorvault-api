'use strict';

const assert = require('assert');
const { VAULT_URL, getWelcomeEmail } = require('../lib/onboarding-emails');

assert(
  !/gatorvault\.com\/vault\/?$/.test(VAULT_URL) && !VAULT_URL.includes('://gatorvault.com/'),
  `VAULT_URL must not use dead gatorvault.com host: ${VAULT_URL}`
);
assert(
  VAULT_URL.includes('gatorvaultinsider.com') || process.env.GV_VAULT_URL || process.env.SITE_URL,
  `VAULT_URL should target gatorvaultinsider.com by default: ${VAULT_URL}`
);
assert(VAULT_URL.includes('/join/') || VAULT_URL.includes('/vault/'), `VAULT_URL missing join/vault path: ${VAULT_URL}`);

const welcome = getWelcomeEmail({ name: 'Bookhimdano', email: 'test@example.com', tier: 'film' });
assert(welcome.html.includes(VAULT_URL), 'welcome HTML must include VAULT_URL');
assert(!welcome.html.includes('https://gatorvault.com/vault'), 'welcome HTML must not include dead vault URL');
assert.strictEqual(welcome.templateParams.vault_url, VAULT_URL);

console.log('[verify-welcome-email-url] OK', VAULT_URL);
