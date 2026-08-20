#!/usr/bin/env node
/**
 * Dry-run or send iOS App Store update email to members.
 *
 * Local dry-run:
 *   node server/scripts/announce-ios-update.js --dry-run
 *
 * Production (after deploy) via Admin API:
 *   curl -sS -X POST https://gatorvault-api.onrender.com/api/admin/members/announce-ios \
 *     -H 'Content-Type: application/json' -H 'X-Admin-Pin: YOUR_PIN' \
 *     -d '{"version":"1.0.15","dryRun":true}'
 *
 * Live send:
 *   ... -d '{"version":"1.0.15","dryRun":false}'
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
  const version = argValue('--version') || '1.0.15';
  const limit = argValue('--limit') ? Number(argValue('--limit')) : null;

  if (!dryRun && !process.env.RESEND_API_KEY && !process.env.EMAILJS_PRIVATE_KEY) {
    console.error('No email provider in this environment. Use the Admin API on Render instead.');
    process.exit(2);
  }

  // Local script path is for dry-run against whatever users.json is mounted.
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

  const result = await announce.sendIosUpdateAnnounce({
    loadUsers: () => users,
    updateUser,
    deliverEmail,
    version,
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
