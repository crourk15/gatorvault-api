#!/usr/bin/env node
/**
 * Export Beehiiv-ready HTML for each onboarding email.
 * Usage: node scripts/export-onboarding-html.js
 */
const fs = require('fs');
const path = require('path');
const { ONBOARDING_SEQUENCE, onboardingEmailHtml } = require('../lib/onboarding-emails');

const outDir = path.join(__dirname, '..', 'email', 'onboarding');
fs.mkdirSync(outDir, { recursive: true });

ONBOARDING_SEQUENCE.forEach((email) => {
  const slug = `day-${String(email.day).padStart(2, '0')}`;
  const html = onboardingEmailHtml(email, { name: '{{ first_name }}' });
  const meta = `Subject: ${email.subject}\nDelay: ${email.delayLabel}\n\n`;
  fs.writeFileSync(path.join(outDir, `${slug}.html`), meta + html);
  console.log('Wrote', slug + '.html');
});

console.log('\nPaste each file into Beehiiv automation email steps.');
