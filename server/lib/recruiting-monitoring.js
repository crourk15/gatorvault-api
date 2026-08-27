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
const INGEST_STALE_MS = parseInt(process.env.MONITORING_INGEST_STALE_MS || String(2 * 3600000), 10);
const BEAT_STALE_MS = parseInt(process.env.MONITORING_BEAT_STALE_MS || String(15 * 60 * 1000), 10);
const AUTOPOSTER_IDLE_MS = parseInt(process.env.MONITORING_AUTOPOSTER_IDLE_MS || String(6 * 3600000), 10);

const counters = {
  blockedEvents: 0,
  firedEvents: 0,
  verificationFailures: 0,
  snapshotMismatches: 0,
  aggregatorSkips: 0,
  ingestMismatches: 0,
  healthAlerts: 0,
  nationalSkips: 0,
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
  if (type === 'national_skip') counters.nationalSkips = (counters.nationalSkips || 0) + 1;
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
  const pipelineHealth = require('./pipeline-health');
  const status = getIngestStatus();
  const report = pipelineHealth.getHealthReport();
  const now = Date.now();
  const issues = [];

  const lastRunMs = status.lastRun ? new Date(status.lastRun).getTime() : null;
  const ingestStale = !lastRunMs || now - lastRunMs > INGEST_STALE_MS;
  if (process.env.ON3_INGEST_ENABLED === 'true' && ingestStale) {
    issues.push({
      code: 'on3_ingest_stale',
      message: `On3 ingest last run ${status.lastRun || 'never'} (threshold ${Math.round(INGEST_STALE_MS / 3600000)}h)`
    });
  }

  const beatFetchedAt = report.beatCache?.fetchedAt;
  const beatFetchedMs = beatFetchedAt ? new Date(beatFetchedAt).getTime() : null;
  const beatStale = !beatFetchedMs || now - beatFetchedMs > BEAT_STALE_MS;
  if (beatStale) {
    issues.push({
      code: 'beat_stream_stale',
      message: `Beat cache last fetch ${beatFetchedAt || 'never'} (threshold ${Math.round(BEAT_STALE_MS / 60000)}m)`
    });
  }
  if (report.beatCache?.error) {
    issues.push({
      code: 'beat_stream_error',
      message: report.beatCache.error
    });
  }
  if ((report.beatCache?.postCount || 0) === 0 && process.env.X_BEARER_TOKEN) {
    issues.push({
      code: 'beat_stream_empty',
      message: 'Beat cache has zero posts despite X_BEARER_TOKEN being set'
    });
  }

  const lastPostAt = report.autoposter?.lastPostAt || report.autoposter?.lastPostSuccess || null;
  const lastPostMs = lastPostAt ? new Date(lastPostAt).getTime() : null;
  const autoposterIdle =
    process.env.X_AUTOPOST_ENABLED === 'true' &&
    (!lastPostMs || now - lastPostMs > AUTOPOSTER_IDLE_MS);
  if (autoposterIdle) {
    issues.push({
      code: 'autoposter_idle',
      message: `No autoposter success since ${lastPostAt || 'never'} (threshold ${Math.round(AUTOPOSTER_IDLE_MS / 3600000)}h)`
    });
  }
  if (report.autoposter?.lastError) {
    issues.push({
      code: 'autoposter_error',
      message: report.autoposter.lastError
    });
  }

  try {
    const intelStore = require('./recruiting-intel-store');
    const ghost = intelStore.reconcileGhostQueuedIntel();
    if (ghost.cleared) {
      issues.push({
        code: 'autoposter_ghost_queue',
        message: `Cleared ${ghost.cleared} intel row(s) with xPostQueued but no queue item`
      });
    }
  } catch {
    /* optional */
  }

  if ((process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL) && process.env.NODE_ENV === 'production') {
    try {
      const { Pool } = require('pg');
      const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
      const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await pool.query('select 1');
      await pool.end();
    } catch (e) {
      issues.push({
        code: 'futurecast_db_unreachable',
        message: `FutureCast DATABASE_URL check failed: ${e.message}`
      });
    }
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

  // FutureCast HP durable plates — catch week-old DISK freezes before fans notice.
  let hpFreshness = null;
  try {
    const {
      getHighPriorityFreshnessReport,
      scheduleStaleHighPriorityRebuilds,
    } = require('./futurecast-hp-freshness');
    hpFreshness = getHighPriorityFreshnessReport([2027, 2028]);
    const open = hpFreshness.byYear?.['2028'];
    if (open?.stale) {
      issues.push({
        code: 'hp_plate_stale',
        message: open.missing
          ? 'FutureCast 2028 HP plate missing on disk'
          : `FutureCast 2028 HP plate age ${open.ageHours ?? '?'}h (threshold ${open.maxAgeHours}h)`
      });
      try {
        scheduleStaleHighPriorityRebuilds([2028], 'pipeline-healthcheck');
      } catch {
        /* schedule is best-effort */
      }
    }
  } catch (e) {
    console.warn('[recruiting-monitoring] HP freshness check failed:', e.message);
  }

  const healthReport = {
    ok: issues.length === 0,
    at: new Date().toISOString(),
    ingest: {
      enabled: process.env.ON3_INGEST_ENABLED === 'true',
      lastRun: status.lastRun,
      initialized: status.initialized,
      stale: ingestStale,
      staleThresholdMs: INGEST_STALE_MS
    },
    beat: {
      fetchedAt: beatFetchedAt,
      postCount: report.beatCache?.postCount || 0,
      error: report.beatCache?.error || null,
      stale: beatStale,
      staleThresholdMs: BEAT_STALE_MS
    },
    autoposter: {
      enabled: process.env.X_AUTOPOST_ENABLED === 'true',
      lastPostAt,
      queuePending: report.autoposter?.queuePending || 0,
      idle: autoposterIdle,
      idleThresholdMs: AUTOPOSTER_IDLE_MS,
      lastError: report.autoposter?.lastError || null
    },
    highPriority: hpFreshness,
    counters: getCounters(),
    recentIngestLog: status.recentLog || [],
    issues
  };

  if (
    issues.some((i) =>
      ['beat_stream_error', 'autoposter_error', 'on3_ingest_stale', 'hp_plate_stale'].includes(i.code)
    )
  ) {
    counters.healthAlerts += 1;
    await sendMonitoringAlert({
      level: 'warning',
      type: 'health_alert',
      reason: issues.map((i) => i.message).join('; '),
      detail: 'Pipeline health check detected abnormalities',
      meta: { issues },
      notify: true
    });
  }

  try {
    const apMon = require('./autoposter/autoposter-monitoring');
    await apMon.alertIfIdle(healthReport.autoposter || report.autoposter || {});
    await apMon.checkBeatFreshness({ cache: report.beatCache || {} });
    await apMon.checkOn3Ingest({
      lastParsedCount: status.lastParsedCount ?? status.lastFired ?? 0,
      lastRun: status.lastRun,
      lastRunAgeHours: status.lastRun ? (now - new Date(status.lastRun).getTime()) / 3600000 : Infinity
    });
    await apMon.checkRewriteFailures(apMon.getRewriteFailureStats());
  } catch (e) {
    console.warn('[recruiting-monitoring] autoposter monitoring hooks failed:', e.message);
  }

  return healthReport;
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
