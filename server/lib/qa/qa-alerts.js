/**
 * QA alert delivery — Slack, Discord, email with screenshot + repro steps.
 */
const fetch = require('node-fetch');
const config = require('./qa-config');
const opsAlerts = require('../ops-alerts');

const DISCORD_WEBHOOK = process.env.MONITORING_DISCORD_WEBHOOK || process.env.DISCORD_WEBHOOK_URL || null;
const ALERT_EMAIL = process.env.MONITORING_ALERT_EMAIL || process.env.ALERT_EMAIL || null;

async function notifySlack(payload) {
  if (!config.SLACK_WEBHOOK) return { skipped: true };
  try {
    const r = await fetch(config.SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function formatErrorBlock(run) {
  const lines = (run.errors || []).slice(0, 8).map((e) => {
    const parts = [`• *${e.module}/${e.id}*: ${e.message}`];
    if (e.url) parts.push(`  URL: ${e.url}`);
    if (e.repro) parts.push(`  Repro: ${e.repro}`);
    return parts.join('\n');
  });
  return lines.join('\n') || 'Unknown failure';
}

async function sendQaFailureAlert(run) {
  const title = `QA Crawler FAILED — ${run.summary?.failed || 0} check(s)`;
  const message = [
    `Run ${run.id} at ${run.finishedAt}`,
    `Duration: ${run.durationMs}ms`,
    `Modules: ${Object.entries(run.modules || {})
      .map(([k, v]) => `${k}=${v.pass ? 'PASS' : 'FAIL'}`)
      .join(', ')}`,
    '',
    formatErrorBlock(run)
  ].join('\n');

  const screenshot = run.screenshot || null;
  const dedupeKey = `qa-fail-${run.summary?.failed}-${(run.errors || [])[0]?.id || 'general'}`;

  const alert = {
    severity: 'error',
    type: 'qa_regression',
    title,
    message,
    subsystem: 'qa:crawler',
    dedupeKey,
    meta: {
      runId: run.id,
      errors: (run.errors || []).slice(0, 10),
      screenshot,
      siteUrl: config.SITE_URL,
      apiUrl: config.API_URL
    }
  };

  const opsResult = await opsAlerts.fireAlert(alert, { notify: true });

  const slackBlocks = {
    text: title,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: title } },
      { type: 'section', text: { type: 'mrkdwn', text: message.slice(0, 2900) } }
    ]
  };
  if (screenshot) {
    slackBlocks.blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Screenshot: \`${screenshot}\` (see QA dashboard)` }]
    });
  }

  const slack = await notifySlack(slackBlocks);

  if (DISCORD_WEBHOOK && !config.SLACK_WEBHOOK) {
    /* opsAlerts already hit Discord */
  }

  return { ops: opsResult, slack };
}

async function sendQaRecoveryAlert(run) {
  return opsAlerts.fireAlert(
    {
      severity: 'info',
      type: 'qa_recovery',
      title: 'QA Crawler recovered — all checks passing',
      message: `Run ${run.id} passed at ${run.finishedAt}`,
      subsystem: 'qa:crawler',
      dedupeKey: 'qa-recovery'
    },
    { notify: true }
  );
}

module.exports = {
  sendQaFailureAlert,
  sendQaRecoveryAlert,
  notifySlack
};
