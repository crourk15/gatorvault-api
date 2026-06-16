/**
 * Monitoring webhook client — Discord alerts for autoposter + pipeline monitoring.
 */
const fetch = require('node-fetch');

const DISCORD_WEBHOOK =
  process.env.MONITORING_DISCORD_WEBHOOK || process.env.DISCORD_WEBHOOK_URL || null;

async function send(message) {
  const text = String(message || '').trim();
  if (!text) return { skipped: true, reason: 'empty_message' };
  if (!DISCORD_WEBHOOK) {
    console.warn('[monitoring-webhook]', text);
    return { skipped: true, reason: 'no_webhook' };
  }
  try {
    const r = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.slice(0, 1900) })
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { send };
