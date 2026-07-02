/** Phase 3 — post-type performance memory. */
const fs = require('fs');
const path = require('path');
const PERF_PATH = path.join(__dirname, '..', '..', 'data', 'x', 'autoposter-performance.json');
function performanceLoopEnabled() { return process.env.X_AUTOPOST_PERFORMANCE_LOOP !== 'false'; }
function dimensionsFromItem(item) { return { source: String(item && item.source || 'unknown').slice(0, 64), topic: String(item && item.topic || 'general').slice(0, 32), sourceEventType: String(item && item.sourceEventType || 'news').slice(0, 32) }; }
function dimKey(d) { return d.source + '|' + d.topic + '|' + d.sourceEventType; }
function readStore() { try { return JSON.parse(fs.readFileSync(PERF_PATH, 'utf8')); } catch { return { totals: {}, recent: [] }; } }
function writeStore(doc) { fs.mkdirSync(path.dirname(PERF_PATH), { recursive: true }); doc.updatedAt = new Date().toISOString(); fs.writeFileSync(PERF_PATH, JSON.stringify(doc, null, 2), 'utf8'); }
function recordPostPerformance(item) { if (!performanceLoopEnabled() || !item) return null; const d = dimensionsFromItem(item); const key = dimKey(d); const doc = readStore(); if (!doc.totals[key]) doc.totals[key] = { count: 0 }; doc.totals[key].count += 1; doc.totals[key].lastPostedAt = item.sentAt || new Date().toISOString(); writeStore(doc); return { key, count: doc.totals[key].count }; }
function candidatePerformanceBoost(c) { if (!performanceLoopEnabled()) return 0; const key = dimKey(dimensionsFromItem(c)); const row = readStore().totals[key]; if (!row || !row.count) return 0; const hours = (Date.now() - new Date(row.lastPostedAt || 0).getTime()) / 3600000; if (hours < 6) return -3; if (row.count >= 8) return -1; return 0; }
function getPerformanceSummary() {
  const totals = readStore().totals || {};
  const topTypes = Object.entries(totals).sort((a, b) => (b[1].count || 0) - (a[1].count || 0)).slice(0, 8).map(([key, row]) => ({ key, count: row.count || 0, lastPostedAt: row.lastPostedAt || null }));
  return { enabled: performanceLoopEnabled(), typeCount: Object.keys(totals).length, topTypes };
}
module.exports = { performanceLoopEnabled, recordPostPerformance, candidatePerformanceBoost, getPerformanceSummary };
