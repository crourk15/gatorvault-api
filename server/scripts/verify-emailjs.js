#!/usr/bin/env node
/** Verify EmailJS keys from server/.env — does not send email unless --send is passed. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const publicKey = process.env.EMAILJS_PUBLIC_KEY;
const privateKey = process.env.EMAILJS_PRIVATE_KEY;
const serviceId = process.env.EMAILJS_SERVICE_ID;
const templateId = process.env.EMAILJS_TEMPLATE_ID;
const to = process.argv.find((a) => a.startsWith('--to='))?.split('=')[1] || process.env.EMAIL_TEST_TO || '';
const doSend = process.argv.includes('--send');

async function main() {
  console.log('EmailJS config check:');
  console.log('  publicKey:', publicKey ? `${publicKey.slice(0, 6)}… (${publicKey.length} chars)` : '(missing)');
  console.log('  privateKey:', privateKey ? `${privateKey.slice(0, 4)}… (${privateKey.length} chars)` : '(missing)');
  console.log('  serviceId:', serviceId || '(missing)');
  console.log('  templateId:', templateId || '(missing)');

  if (!publicKey || !privateKey || !serviceId || !templateId) {
    console.error('\nMissing required EmailJS env vars in server/.env');
    process.exit(1);
  }

  const emailjs = require('@emailjs/nodejs');
  const params = {
    to_email: to || 'verify@example.com',
    user_email: to || 'verify@example.com',
    email: to || 'verify@example.com',
    to_name: 'GatorVault Verify',
    user_name: 'GatorVault Verify',
    tier_name: 'Film Room',
    trial_end: 'July 1, 2026',
    login_url: process.env.SITE_URL || 'https://gatorvaultinsider.com',
    email_subject: 'GatorVault EmailJS Verify',
    message_html: '<p>EmailJS verification test from GatorVault server.</p>',
    onboarding_day: '0'
  };

  if (!doSend) {
    console.log('\nDry run only. Pass --send --to=you@email.com to send a real test email.');
    process.exit(0);
  }

  if (!to) {
    console.error('Pass --to=your@email.com for a live send test');
    process.exit(1);
  }

  try {
    const res = await emailjs.send(serviceId, templateId, params, { publicKey, privateKey });
    console.log('\nSUCCESS', res.status, res.text);
  } catch (err) {
    console.error('\nFAILED', err.status || '', err.text || err.message || err);
    process.exit(1);
  }
}

main();
