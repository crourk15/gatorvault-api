#!/usr/bin/env node
/**
 * Render cron — UF kickoff/final score pushes (no-ops outside game windows).
 */
try {
  require('./render-cron-env');
} catch {
  /* optional */
}

async function main() {
  const { runGatorsScoreAlerts } = require('../lib/gators-score-alerts');
  const out = await runGatorsScoreAlerts({});
  console.log(JSON.stringify({ ok: true, ...out }));
  process.exit(0);
}

main().catch((err) => {
  console.error('[gators-score-alerts-cron]', err && err.message ? err.message : err);
  process.exit(0);
});
