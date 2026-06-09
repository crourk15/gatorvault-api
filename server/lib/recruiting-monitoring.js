/**
 * Recruiting pipeline monitoring — alerts, counters, health checks.
 * Stores last 50 alerts on disk; optional Discord webhook + email.
 */
const fs = require('fs');
const path = require('path');

const fetch = require('node-fetch');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const ALERTS_PATH = path.join(DATA_DIR, 'monitoring-alerts.json');
const MAX_ALERTS = 50;

const MONITORING_SECRET =
  process.env.MONITORING_SECRET || process.env.INGEST_CRON_SECRET || process.env.RECRUITING_ADMIN_PIN || 'GV2026admin';
const DISCORD_WEBHOOK = process.env.MONITORING_DISCORD_WEBHOOK || process.env.DISCORD_WEBHOOK_URL || null;
const ALERT_EMAIL = process.env.MONITORING_ALERT_EMAIL || process.env.ALERT_EMAIL || null;
const INGEST_STALE_MS = parseInt(process.env.MONITORING_INGEST_STALE_MS || '600000', 10);

const counters = {
  blockedEvents: 0,
  firedEvents: 0,
  verificationFailures: 0,
  snapshotMismatches: 0,
  aggregatorSkips: 0,
  ingestMismatches: 0,
  healthAlerts: 0,
  startedAt: new Date().toISOString()
};

function readAlertsDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(ALERTS_PATH, 'utf8'));
    return { version: 1, alerts: Array.isArray(raw.alerts) ? raw.alerts : [], updatedAt: raw.updatedAt || null };
  } catch {
    return { version: 1, alerts: [], updatedAt: null };
  }
}

function writeAlertsDoc(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(ALERTS_PATH, JSON.stringify(doc, null, 2));
}

function bumpCounter(alert) {
  const type = alert.type;
  if (type === 'blocked_event') {
    counters.blockedEvents += 1;
    if (alert.eventType === 'decommit') counters.verificationFailures += 1;
  }
  if (type === 'ingest_mismatch') {
    counters.ingestMismatches += 1;
    if (alert.meta?.snapshotAbsence || alert.meta?.trigger === 'missing_from_board') {
      counters.snapshotMismatches += 1;
    }
  }
  if (type === 'aggregator_skip') counters.aggregatorSkips += 1;
  if (type === 'verification_failure') counters.verificationFailures += 1;
  if (type === 'snapshot_mismatch') counters.snapshotMismatches += 1;
  if (type === 'fired_event') counters.firedEvents += 1;
  if (type === 'health_alert') counters.healthAlerts += 1;
}

function mapDecommitBlockReason(gate, verification, source) {
  if (!verification) return 'Unverified decommit attempt blocked';
  const sourceType = String(verification.sourceType || verification.source || '').toLowerCase();
  if (sourceType === 'on3' && !verification.explicitDecommit) {
    return 'On3 source without explicitDecommit blocked';
  }
  if (gate?.reason === 'snapshot_absence' || gate?.reason === 'missing_from_board') {
    return 'Snapshot absence decommit attempt blocked';
  }
  if (gate?.reason === 'previous_commit_not_florida') {
    return 'Decommit blocked: previous commit was not Florida';
  }
  return gate?.reason ? `Decommit blocked: ${gate.reason}` : 'Decommit validation failed';
}

async function notifyDiscord(alert) {
  if (!DISCORD_WEBHOOK) return null;
  const player = alert.player || alert.playerSlug || 'Unknown';
  const content = [
    `**[${String(alert.level || 'info').toUpperCase()}] ${alert.type}**`,
    alert.eventType ? `Event: \`${alert.eventType}\`` : null,
    `Player: **${player}**`,
    alert.reason || alert.detail ? `Reason: ${alert.reason || alert.detail}` : null,
    alert.source ? `Source: ${alert.source}` : null,
    `\`${alert.at}\``
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const r = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900) })
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function notifyEmail(alert) {
  if (!ALERT_EMAIL) return null;
  try {
    const sgMail = require('@sendgrid/mail');
    const key = process.env.SENDGRID_API_KEY;
    if (!key) return { skipped: true, reason: 'no_sendgrid_key' };
    sgMail.setApiKey(key);
    const player = alert.player || alert.playerSlug || 'Unknown';
    await sgMail.send({
      to: ALERT_EMAIL,
      from: process.env.SENDGRID_FROM || process.env.EMAILJS_REPLY_TO || 'alerts@gatorvault.com',
      subject: `[GatorVault] ${alert.type}: ${player}`,
      text: JSON.stringify(alert, null, 2)
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Record a pipeline monitoring alert.
 */
async function sendMonitoringAlert(payload = {}) {
  const alert = {
    id: `mon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: payload.timestamp || Date.now(),
    at: new Date().toISOString(),
    level: payload.level || 'info',
    type: payload.type || 'unknown',
    eventType: payload.eventType || null,
    player: payload.player || payload.playerName || null,
    playerSlug: payload.playerSlug || null,
    reason: payload.reason || null,
    detail: payload.detail || null,
    source: payload.source || null,
    meta: payload.meta || null
  };

  bumpCounter(alert);

  const doc = readAlertsDoc();
  doc.alerts.unshift(alert);
  doc.alerts = doc.alerts.slice(0, MAX_ALERTS);
  writeAlertsDoc(doc);

  const logLine = `[monitoring] ${alert.level}/${alert.type}${alert.eventType ? `/${alert.eventType}` : ''} ${alert.player || '-'} — ${alert.reason || alert.detail || ''}`;
  if (alert.level === 'warning' || alert.level === 'error') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  const notify = payload.notify !== false && (alert.level === 'warning' || alert.level === 'error');
  let discord = null;
  let email = null;
  if (notify) {
    discord = await notifyDiscord(alert);
    email = await notifyEmail(alert);
  }

  return { alert, discord, email };
}

function recordFiredEvent(meta = {}) {
  bumpCounter('fired_event');
  return { ok: true, meta };
}

function listAlerts({ limit = MAX_ALERTS } = {}) {
  const doc = readAlertsDoc();
  const n = Math.min(MAX_ALERTS, parseInt(limit, 10) || MAX_ALERTS);
  return { alerts: doc.alerts.slice(0, n), updatedAt: doc.updatedAt, counters: { ...counters } };
}

function getCounters() {
  return { ...counters };
}

function verifyMonitoringSecret(secret) {
  return !!secret && secret === MONITORING_SECRET;
}

async function runHealthCheck() {
  const { getIngestStatus } = require('./on3-ingest');
  const status = getIngestStatus();
  const now = Date.now();
  const issues = [];

  const lastRunMs = status.lastRun ? new Date(status.lastRun).getTime() : null;
  const stale = !lastRunMs || now - lastRunMs > INGEST_STALE_MS;
  if (process.env.ON3_INGEST_ENABLED === 'true' && stale) {
    issues.push({
      code: 'ingest_stale',
      message: `On3 ingest last run ${status.lastRun || 'never'} (threshold ${INGEST_STALE_MS}ms)`
    });
  }

  if (counters.blockedEvents > 0 && counters.verificationFailures > 5) {
    issues.push({
      code: 'high_verification_failures',
      message: `${counters.verificationFailures} verification failures since boot`
    });
  }

  if (counters.snapshotMismatches > 10) {
    issues.push({
      code: 'high_snapshot_mismatches',
      message: `${counters.snapshotMismatches} snapshot mismatches since boot`
    });
  }

  const report = {
    ok: issues.length === 0,
    at: new Date().toISOString(),
    ingest: {
      enabled: process.env.ON3_INGEST_ENABLED === 'true',
      lastRun: status.lastRun,
      initialized: status.initialized,
      stale,
      staleThresholdMs: INGEST_STALE_MS
    },
    counters: getCounters(),
    recentIngestLog: status.recentLog || [],
    issues
  };

  if (issues.length) {
    counters.healthAlerts += 1;
    await sendMonitoringAlert({
      level: 'warning',
      type: 'health_alert',
      reason: issues.map((i) => i.message).join('; '),
      detail: 'Recruiting pipeline health check detected abnormalities',
      meta: { issues },
      notify: true
    });
  }

  return report;
}

module.exports = {
  sendMonitoringAlert,
  recordFiredEvent,
  listAlerts,
  getCounters,
  verifyMonitoringSecret,
  runHealthCheck,
  mapDecommitBlockReason,
  MAX_ALERTS,
  MONITORING_SECRET
};
