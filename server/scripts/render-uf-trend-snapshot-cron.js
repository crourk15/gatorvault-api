#!/usr/bin/env node
/**
 * Render cron — daily UF % trend snapshots for allowlist targets.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const SNAPSHOT_URL =
  process.env.UF_TREND_SNAPSHOT_URL ||
  "https://gatorvault-api.onrender.com/api/futurecast/uf-trend/snapshot";
const CRON_SECRET = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || "";

const RETRY_STATUSES = new Set([502, 503, 504, 429]);
const MAX_ATTEMPTS = 4;
const RETRY_MS = 5000;

async function postSnapshot() {
  if (!CRON_SECRET) throw new Error("MONITORING_CRON_SECRET (or CRON_SECRET) is not set");
  const started = Date.now();
  const res = await fetch(SNAPSHOT_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-monitoring-cron": CRON_SECRET,
      "User-Agent": "gatorvault-uf-trend-snapshot-cron/1.0",
    },
    body: "{}",
    signal: AbortSignal.timeout(120000),
  });
  const elapsed = Date.now() - started;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(`uf trend snapshot HTTP ${res.status} (${elapsed}ms)`);
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
      return await postSnapshot();
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
  console.log("[uf-trend-snapshot-cron] ok", JSON.stringify(result.body));
  process.exit(0);
})().catch((err) => {
  console.error("[uf-trend-snapshot-cron] failed:", err.message, err.body || "");
  process.exit(0);
});