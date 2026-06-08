#!/usr/bin/env node
/** Verify EmailJS server-side send (raw REST — any public key format). */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sendEmailViaEmailJS } = require('../lib/emailjs-server');
const { getEmailJsConfig, getEmailJsPublicKeyHint } = require('../lib/emailjs-config');

const to = process.argv.find((a) => a.startsWith('--to='))?.split('=')[1] || process.env.EMAIL_TEST_TO || '';
const doSend = process.argv.includes('--send');

async function main() {
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();

  console.log('EmailJS server REST config (keys passed verbatim, no format validation):');
  console.log('  publicKey hint:', getEmailJsPublicKeyHint() || '(missing)');
  console.log('  privateKey:', privateKey ? `${privateKey.slice(0, 4)}… (${privateKey.length} chars)` : '(missing)');
  console.log('  serviceId:', serviceId || '(missing)');
  console.log('  templateId:', templateId || '(missing)');

  if (!privateKey || !publicKey || !serviceId || !templateId) {
    console.error('\nMissing EMAILJS_USER_ID (or EMAILJS_PUBLIC_KEY), EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID, or EMAILJS_TEMPLATE_ID');
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
      publicKey,
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
