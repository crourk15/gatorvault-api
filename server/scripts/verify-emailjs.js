#!/usr/bin/env node
/** Verify EmailJS welcome email send (single onboarding email). */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sendEmailViaEmailJS } = require('../lib/emailjs-server');
const { getEmailJsConfig, getEmailJsPublicKeyHint } = require('../lib/emailjs-config');
const { getWelcomeEmail } = require('../lib/onboarding-emails');

const to = process.argv.find((a) => a.startsWith('--to='))?.split('=')[1] || process.env.EMAIL_TEST_TO || '';
const doSend = process.argv.includes('--send');

async function main() {
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();
  const welcome = getWelcomeEmail({ name: 'GatorVault Verify', email: to || 'test@example.com', tier: 'film' });

  console.log('EmailJS welcome email config:');
  console.log('  publicKey hint:', getEmailJsPublicKeyHint() || '(missing)');
  console.log('  privateKey:', privateKey ? `${privateKey.slice(0, 4)}… (${privateKey.length} chars)` : '(missing)');
  console.log('  serviceId:', serviceId || '(missing)');
  console.log('  templateId:', templateId || '(missing)');
  console.log('  subject:', welcome.subject);

  if (!privateKey || !publicKey || !serviceId || !templateId) {
    console.error('\nMissing EMAILJS_USER_ID, EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID, or EMAILJS_TEMPLATE_ID');
    process.exit(1);
  }

  if (!doSend) {
    console.log('\nDry run only. Pass --send --to=you@email.com to send the welcome email.');
    process.exit(0);
  }

  if (!to) {
    console.error('Pass --to=your@email.com for a live send test');
    process.exit(1);
  }

  try {
    const res = await sendEmailViaEmailJS({
      serviceId,
      templateId,
      publicKey,
      privateKey,
      templateParams: {
        to_email: to,
        ...welcome.templateParams,
        email_subject: welcome.subject,
        message_html: welcome.html
      }
    });
    console.log('\nSUCCESS', res.status, res.text);
  } catch (err) {
    console.error('\nFAILED', err.message || err);
    process.exit(1);
  }
}

main();
