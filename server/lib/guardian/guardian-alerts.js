/**
 * Guardian alerts — Slack, Discord, email via GV-OM ops-alerts.
 */
const fetch = require('node-fetch');

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || process.env.QA_SLACK_WEBHOOK || null;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || null;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || null;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || null;
const ALERT_SMS_TO = process.env.GUARDIAN_ALERT_SMS || process.env.ALERT_SMS_TO || null;

async function notifySms(message) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !ALERT_SMS_TO) {
    return { skipped: true, reason: 'twilio_not_configured' };
  }
  try {
    const body = new URLSearchParams({
      To: ALERT_SMS_TO,
      From: TWILIO_FROM,
      Body: message.slice(0, 1500)
    });
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      }
    );
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function notifySlack(message) {
  if (!SLACK_WEBHOOK) return { skipped: true, reason: 'no_slack_webhook' };
  try {
    const r = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message.slice(0, 3900) })
    });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function alertGuardian(event) {
  const prefix = '[guardian]';
  const message = `${prefix} ${event.title}: ${event.message}`;
  console.error(message);

  let opsResult = null;
  try {
    const opsAlerts = require('../ops-alerts');
    opsResult = await opsAlerts.fireAlert(
      {
        type: event.type || 'guardian',
        severity: event.severity || 'error',
        title: `${prefix} ${event.title}`,
        message: event.message,
        subsystem: event.subsystem || 'guardian',
        dedupeKey: event.dedupeKey || `guardian:${event.type}:${event.title}`,
        meta: event.meta || null
      },
      { notify: event.notify !== false }
    );
  } catch (err) {
    console.warn('[guardian] ops-alerts failed:', err.message);
  }

  const slack = await notifySlack(message);
  const sms =
    event.severity === 'critical' || event.notifySms ? await notifySms(message) : { skipped: true };
  return { message, opsResult, slack, sms };
}

module.exports = { alertGuardian, notifySlack, notifySms };
