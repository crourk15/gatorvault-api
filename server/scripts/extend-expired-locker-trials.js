#!/usr/bin/env node
/**
 * Courtesy +30 days for expired locker trials + win-back email.
 *
 * Local dry-run (no mail, no writes unless users.json is mounted):
 *   node server/scripts/extend-expired-locker-trials.js --dry-run
 *
 * Production (after this ships on Render):
 *   curl -sS -X POST https://gatorvault-api.onrender.com/api/admin/members/extend-trial \
 *     -H 'Content-Type: application/json' -H 'X-Ops-Pin: YOUR_PIN' \
 *     -d '{"emails":["mekeener50@gmail.com",...],"days":30,"sendEmail":true,"dryRun":true}'
 *
 * Live send:
 *   ... -d '{"emails":[...],"days":30,"sendEmail":true,"dryRun":false}'
 *
 * Default list is the Sep 2026 Admin Hub expired locker paste (test/demo skipped).
 */
'use strict';

const { SEP_2026_EXPIRED_LOCKER, runLockerWinback } = require('../lib/locker-winback');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag('--dry-run') || hasFlag('--dryRun') || !hasFlag('--send');
  const force = hasFlag('--force');
  const sendEmail = !hasFlag('--no-email');
  const emails = SEP_2026_EXPIRED_LOCKER.map((row) => row.email);

  if (!dryRun && !process.env.RESEND_API_KEY && !process.env.EMAILJS_PRIVATE_KEY) {
    console.error('No email provider in this environment. Use the Admin API on Render instead.');
    process.exit(2);
  }

  let deliverEmail = async () => ({ sent: false, provider: 'noop' });
  if (!dryRun && sendEmail) {
    const resend = require('../lib/resend-server');
    if (resend.isResendReady()) {
      deliverEmail = async (to, subject, html) => resend.sendEmailViaResend({ to, subject, html });
    } else {
      console.error('RESEND_API_KEY required for --send locally');
      process.exit(2);
    }
  }

  const result = await runLockerWinback({
    emails,
    days: 30,
    sendEmail,
    dryRun,
    force,
    deliverEmail,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
