#!/usr/bin/env node
const https = require("https");
const http = require("http");
const API_ORIGIN = process.env.API_ORIGIN || "https://gatorvault-api.onrender.com";
const TIMEOUT_MS = Number(process.env.COLD_START_TIMEOUT_MS || 120000);
const MAX_LATENCY_MS = Number(process.env.COLD_START_MAX_MS || 45000);
const EXPECTED_COMMITS = {
  2026: { commits: "19", commitLabel: "Signees" },
  2027: { commits: "24", commitLabel: "Commits" },
  2028: { commits: "\u2014", commitLabel: "Commits" },
};
function fetchJson(path, timeoutMs = 90000) {
  const url = API_ORIGIN + path;
  const lib = url.startsWith("https") ? https : http;
  const started = Date.now();
  return new Promise((resolve) => {
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        const ms = Date.now() - started;
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, ms, json });
      });
    });
    req.on("error", (err) => resolve({ ok: false, status: 0, ms: Date.now() - started, error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0, ms: Date.now() - started, error: "timeout" }); });
  });
}
async function main() {
  console.log("[verify-cold-start-api] origin=" + API_ORIGIN);
  const deadline = Date.now() + TIMEOUT_MS;
  let healthOk = false;
  while (Date.now() < deadline && !healthOk) {
    const health = await fetchJson("/api/health", 30000);
    healthOk = health.ok;
    if (!healthOk) { console.log("[verify-cold-start-api] waiting for API wake", health.error || health.status); await new Promise((r) => setTimeout(r, 3000)); }
  }
  if (!healthOk) { console.error("[verify-cold-start-api] FAIL API timeout"); process.exitCode = 1; return; }
  const failures = [];
  for (const year of [2026, 2027, 2028]) {
    const res = await fetchJson("/api/recruiting/class-metrics?year=" + year);
    const expected = EXPECTED_COMMITS[year];
    const got = res.json || {};
    const cacheKey = got.meta && got.meta.cacheKey ? got.meta.cacheKey : "n/a";
    console.log("[class-metrics " + year + "] " + (res.ok ? "OK" : "FAIL") + " " + res.ms + "ms commits=" + got.commits + " key=" + cacheKey);
    if (!res.ok) failures.push("class-metrics " + year + ": HTTP " + res.status);
    if (res.ok && res.ms > MAX_LATENCY_MS) failures.push("class-metrics " + year + ": slow " + res.ms + "ms");
    if (String(got.commits) !== expected.commits) failures.push("class-metrics " + year + ": commits " + got.commits + " expected " + expected.commits);
    if (got.commitLabel !== expected.commitLabel) failures.push("class-metrics " + year + ": label mismatch");
    if (String(cacheKey).indexOf("hs2") === -1) failures.push("class-metrics " + year + ": stale cache key " + cacheKey);
  }
  const bundle = await fetchJson("/api/recruiting/hub/bundle?year=2027");
  console.log("[hub/bundle 2027] " + (bundle.ok ? "OK" : "FAIL") + " " + bundle.ms + "ms");
  if (!bundle.ok) failures.push("hub/bundle HTTP " + bundle.status);
  if (bundle.ok && bundle.ms > MAX_LATENCY_MS) failures.push("hub/bundle slow " + bundle.ms + "ms");
  if (failures.length) { console.error("[verify-cold-start-api] FAIL"); failures.forEach((f) => console.error(" -", f)); process.exitCode = 1; return; }
  console.log("[verify-cold-start-api] PASS");
}
main().catch((err) => { console.error("[verify-cold-start-api] error", err.message); process.exitCode = 1; });