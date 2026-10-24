#!/usr/bin/env node
/**
 * Dry-run or send the Georgia-week trial letter (active trials only).
 *
 *   node server/scripts/announce-georgia-week-trial.js --dry-run
 *
 * Production (after deploy):
 *   curl -sS -X POST https://gatorvault-api.onrender.com/api/admin/members/announce-georgia-week-trial \
 *     -H 'Content-Type: application/json' -H 'X-Admin-Pin: YOUR_PIN' \
 *     -d '{"dryRun":true}'
 *
 * Live send:
 *   ... -d '{"dryRun":false}'
 */
'use strict';

const { loadUsers, updateUser } = require('../lib/user-store');
const announce = require('../lib/member-announce-email');

function hasFlag(flag) {
  return process.argv.includes(flag);
}
function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(flag + '='));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function main() {
  const dryRun = hasFlag('--dry-run') || hasFlag('--dryRun') || !hasFlag('--send');
  const force = hasFlag('--force');
  const limit = argValue('--limit') ? Number(argValue('--limit')) : null;

  if (!dryRun && !process.env.RESEND_API_KEY && !process.env.EMAILJS_PRIVATE_KEY) {
    console.error('No email provider in this environment. Use the Admin API on Render instead.');
    process.exit(2);
  }

  const users = loadUsers();
  let deliverEmail = async () => ({ sent: false, provider: 'noop' });
  if (!dryRun) {
    const resend = require('../lib/resend-server');
    if (resend.isResendReady()) {
      deliverEmail = async (to, subject, html) => resend.sendEmailViaResend({ to, subject, html });
    } else {
      console.error('RESEND_API_KEY required for --send locally');
      process.exit(2);
    }
  }

  const result = await announce.sendGeorgiaWeekTrialAnnounce({
    loadUsers: () => users,
    updateUser,
    deliverEmail,
    dryRun,
    force,
    limit,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
