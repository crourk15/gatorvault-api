#!/usr/bin/env node
/**
 * Trigger Codemagic ios-release workflow.
 *
 * Usage:
 *   CM_API_TOKEN=... CODEMAGIC_APP_ID=... node scripts/trigger-codemagic-ios.js
 *
 * Find token: Codemagic → Account settings → API token
 * Find app id: Codemagic → app → Settings → Application ID
 */
const APP_ID = process.env.CODEMAGIC_APP_ID || '';
const TOKEN = process.env.CM_API_TOKEN || process.env.CODEMAGIC_API_TOKEN || '';
const BRANCH = process.env.CODEMAGIC_BRANCH || 'main';
const WORKFLOW = process.env.CODEMAGIC_WORKFLOW || 'ios-release';

async function main() {
  if (!APP_ID || !TOKEN) {
    console.error('Set CM_API_TOKEN and CODEMAGIC_APP_ID');
    process.exit(1);
  }
  const res = await fetch('https://api.codemagic.io/builds', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': TOKEN,
    },
    body: JSON.stringify({
      appId: APP_ID,
      workflowId: WORKFLOW,
      branch: BRANCH,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Trigger failed:', res.status, JSON.stringify(body, null, 2));
    process.exit(1);
  }
  const buildId = body?._id || body?.buildId || body?.id;
  console.log(JSON.stringify({ ok: true, buildId, branch: BRANCH, workflow: WORKFLOW, body }, null, 2));
  if (buildId) {
    console.log(`Build page: https://codemagic.io/builds/${buildId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
