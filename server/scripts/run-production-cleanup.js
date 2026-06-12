#!/usr/bin/env node
/**
 * Trigger post-deploy feed cleanup on production Render via ops API.
 * Requires RECRUITING_ADMIN_PIN or OPS_ADMIN_PIN in server/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = (process.env.QA_API_URL || process.env.API_BASE_URL || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const PIN = process.env.OPS_ADMIN_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN;

async function main() {
  if (!PIN) {
    console.error('Set OPS_ADMIN_PIN or RECRUITING_ADMIN_PIN in server/.env');
    process.exit(1);
  }

  const jobId = process.argv[2] || 'post-deploy-feed-cleanup';
  console.log(`POST ${API}/api/ops/run-job jobId=${jobId}`);

  const res = await fetch(`${API}/api/ops/run-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': PIN
    },
    body: JSON.stringify({ jobId, options: {} })
  });

  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok || body.ok === false) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
