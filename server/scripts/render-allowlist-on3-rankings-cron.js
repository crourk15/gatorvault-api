#!/usr/bin/env node
/**
 * Render cron — weekly On3 composite + rank sync for UF allowlist targets.
 */
require('./render-cron-env');

const SYNC_URL =
  process.env.ALLOWLIST_ON3_RANKINGS_URL ||
  "https://gatorvault-api.onrender.com/api/admin/engines/allowlist-on3/sync";
const CLASS_YEAR = process.env.ALLOWLIST_ON3_RANKINGS_CLASS_YEAR || "2028";
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || "";

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postSync() {
  if (!CRON_SECRET) throw new Error("MONITORING_CRON_SECRET (or CRON_SECRET) is not set");
  const started = Date.now();
  const url = `${SYNC_URL}?class_year=${encodeURIComponent(CLASS_YEAR)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-monitoring-cron": CRON_SECRET,
      "User-Agent": "gatorvault-allowlist-on3-rankings-cron/1.0",
    },
    body: "{}",
    signal: AbortSignal.timeout(600000),
  });
  const elapsed = Date.now() - started;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(`allowlist on3 rankings HTTP ${res.status} (${elapsed}ms)`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return { status: res.status, elapsed, body };
}

async function postWithRetry() {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await postSync();
    } catch (err) {
      lastErr = err;
      const status = err.status || 0;
      const retryable =
        attempt < MAX_ATTEMPTS - 1 &&
        (RETRY_STATUSES.has(status) ||
          /timeout|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(String(err.message || "")));
      if (!retryable) break;
      await new Promise((r) => setTimeout(r, RETRY_MS * (attempt + 1)));
    }
  }
  throw lastErr;
}

(async () => {
  const result = await postWithRetry();
  console.log("[allowlist-on3-rankings-cron] ok", JSON.stringify(result.body));
  process.exit(0);
})().catch((err) => {
  console.error("[allowlist-on3-rankings-cron] failed:", err.message, err.body || "");
  process.exit(0);
});