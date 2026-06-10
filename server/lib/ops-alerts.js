/**
 * GV-OM alert engine — rules, email, Discord.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'ops', 'ops-alerts-config.json');
const ALERTS_PATH = path.join(__dirname, '..', 'data', 'ops', 'ops-alerts.json');
const MAX_ALERTS = 200;

const DISCORD_WEBHOOK = process.env.MONITORING_DISCORD_WEBHOOK || process.env.DISCORD_WEBHOOK_URL || null;
const ALERT_EMAIL = process.env.MONITORING_ALERT_EMAIL || process.env.ALERT_EMAIL || null;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { thresholds: {} };
  }
}

function readAlertsDoc() {
  try {
    return JSON.parse(fs.readFileSync(ALERTS_PATH, 'utf8'));
  } catch {
    return { version: 1, alerts: [], updatedAt: null };
  }
}

function writeAlertsDoc(doc) {
  fs.mkdirSync(path.dirname(ALERTS_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(ALERTS_PATH, JSON.stringify(doc, null, 2));
}

function dedupeRecent(type, key, windowMs = 3600000) {
  const doc = readAlertsDoc();
  const cutoff = Date.now() - windowMs;
  return doc.alerts.some(
    (a) => a.type === type && a.dedupeKey === key && new Date(a.at).getTime() >= cutoff
  );
}

async function notifyDiscord(alert) {
  if (!DISCORD_WEBHOOK) return { skipped: true };
  const content = [
    `**[GV-OM ${String(alert.severity || 'info').toUpperCase()}] ${alert.title}**`,
    alert.message,
    alert.subsystem ? `Subsystem: \`${alert.subsystem}\`` : null,
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
  if (!ALERT_EMAIL) return { skipped: true };
  try {
    const sgMail = require('@sendgrid/mail');
    const key = process.env.SENDGRID_API_KEY;
    if (!key) return { skipped: true, reason: 'no_sendgrid_key' };
    sgMail.setApiKey(key);
    await sgMail.send({
      to: ALERT_EMAIL,
      from: process.env.SENDGRID_FROM || process.env.EMAILJS_REPLY_TO || 'alerts@gatorvault.com',
      subject: `[GV-OM] ${alert.title}`,
      text: `${alert.message}\n\n${JSON.stringify(alert, null, 2)}`
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function fireAlert(alert, { notify = true } = {}) {
  const entry = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    severity: alert.severity || 'warning',
    type: alert.type,
    title: alert.title,
    message: alert.message,
    subsystem: alert.subsystem || null,
    dedupeKey: alert.dedupeKey || null,
    meta: alert.meta || null
  };

  const doc = readAlertsDoc();
  doc.alerts.unshift(entry);
  if (doc.alerts.length > MAX_ALERTS) doc.alerts.length = MAX_ALERTS;
  writeAlertsDoc(doc);

  let delivery = {};
  if (notify) {
    const [discord, email] = await Promise.all([notifyDiscord(entry), notifyEmail(entry)]);
    delivery = { discord, email };
  }

  return { alert: entry, delivery };
}

async function evaluateEvent(event) {
  const config = loadConfig();
  const streakLimit = config.thresholds?.jobFailureStreak || 3;

  if (event.status === 'error') {
    const opsMonitor = require('./ops-monitor');
    const hb = opsMonitor.getHeartbeat(event.subsystem);
    if (hb && hb.failureStreak >= streakLimit) {
      const key = `streak:${event.subsystem}`;
      if (!dedupeRecent('job_failure_streak', key)) {
        await fireAlert({
          type: 'job_failure_streak',
          severity: 'error',
          title: `${event.subsystem} failed ${hb.failureStreak}x in a row`,
          message: event.message || 'Repeated job failure',
          subsystem: event.subsystem,
          dedupeKey: key,
          meta: { failureStreak: hb.failureStreak }
        });
      }
    }
  }

  if (event.subsystem?.startsWith('autoposter') && event.status === 'skipped') {
    const major =
      event.details?.stars >= 4 ||
      event.details?.eventType === 'official_visit' ||
      event.details?.eventType === 'commit';
    if (major) {
      const key = `miss:${event.details?.playerName || event.message}`;
      if (!dedupeRecent('autoposter_missed_major', key, 7200000)) {
        await fireAlert({
          type: 'autoposter_missed_major',
          severity: 'warning',
          title: 'Autoposter skipped major event',
          message: event.message,
          subsystem: event.subsystem,
          dedupeKey: key,
          meta: event.details
        });
      }
    }
  }
}

async function evaluateStatusReport(report) {
  for (const tile of report.tiles || []) {
    if (tile.status !== 'red') continue;
    const key = `red:${tile.id}`;
    if (dedupeRecent('subsystem_red', key, 1800000)) continue;
    await fireAlert({
      type: 'subsystem_red',
      severity: tile.id === 'deployments' ? 'error' : 'warning',
      title: `${tile.label} is RED`,
      message: tile.summary || tile.lastMessage || 'Subsystem unhealthy',
      subsystem: tile.id,
      dedupeKey: key,
      meta: { tile }
    });
  }

  if (report.deployments?.mismatch) {
    const key = 'deploy:mismatch';
    if (!dedupeRecent('deploy_mismatch', key)) {
      await fireAlert({
        type: 'deploy_mismatch',
        severity: 'warning',
        title: 'API / frontend deploy mismatch',
        message: `API ${report.deployments.api?.version} vs frontend ${report.deployments.frontend?.version}`,
        subsystem: 'deployments',
        dedupeKey: key
      });
    }
  }
}

function listAlerts({ limit = 50 } = {}) {
  const doc = readAlertsDoc();
  return {
    alerts: doc.alerts.slice(0, Math.min(limit, MAX_ALERTS)),
    updatedAt: doc.updatedAt
  };
}

module.exports = {
  fireAlert,
  evaluateEvent,
  evaluateStatusReport,
  listAlerts,
  loadConfig
};
