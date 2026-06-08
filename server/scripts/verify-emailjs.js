#!/usr/bin/env node
/** Verify EmailJS server-side send (private key only — no public key). */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sendEmailViaEmailJS } = require('../lib/emailjs-server');

const privateKey = process.env.EMAILJS_PRIVATE_KEY;
const serviceId = process.env.EMAILJS_SERVICE_ID;
const templateId = process.env.EMAILJS_TEMPLATE_ID;
const to = process.argv.find((a) => a.startsWith('--to='))?.split('=')[1] || process.env.EMAIL_TEST_TO || '';
const doSend = process.argv.includes('--send');

async function main() {
  console.log('EmailJS server-side config (private key only):');
  console.log('  privateKey:', privateKey ? `${privateKey.slice(0, 4)}… (${privateKey.length} chars)` : '(missing)');
  console.log('  serviceId:', serviceId || '(missing)');
  console.log('  templateId:', templateId || '(missing)');

  if (!privateKey || !serviceId || !templateId) {
    console.error('\nMissing EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID, or EMAILJS_TEMPLATE_ID in server/.env');
    process.exit(1);
  }

  if (!doSend) {
    console.log('\nDry run only. Pass --send --to=you@email.com to send a test email.');
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
      privateKey,
      templateParams: {
        to_email: to,
        user_email: to,
        email: to,
        to_name: 'GatorVault Verify',
        user_name: 'GatorVault Verify',
        user_tier: 'Film Room',
        tier_name: 'Film Room',
        email_subject: 'GatorVault EmailJS Verify',
        message_html: '<p>EmailJS server verify test.</p>',
        onboarding_day: '0'
      }
    });
    console.log('\nSUCCESS', res.status, res.text);
  } catch (err) {
    console.error('\nFAILED', err.message || err);
    process.exit(1);
  }
}

main();
