/**
 * Product Intelligence — persistence (server/data/ops/product-intel.json).
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'ops', 'product-intel.json');
const MAX_DAILY = 60;
const MAX_WEEKLY = 26;
const MAX_FIX_QUEUE = 200;
const MAX_SNAPSHOTS = 90;

function emptyDoc() {
  return {
    version: 1,
    updatedAt: null,
    lastRunId: null,
    lastComputedAt: null,
    scores: {
      modules: {},
      pages: {},
      features: {},
      overall: null
    },
    fixQueue: [],
    dailySummaries: [],
    weeklyReports: [],
    snapshots: [],
    recommendations: { remove: [], keep: [], upgrade: [] }
  };
}

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function upsertFixQueue(doc, items) {
  const byId = new Map((doc.fixQueue || []).map((i) => [i.id, i]));
  items.forEach((item) => {
    const existing = byId.get(item.id);
    if (existing) {
      byId.set(item.id, { ...existing, ...item, updatedAt: new Date().toISOString() });
    } else {
      byId.set(item.id, item);
    }
  });

  const resolvedIds = new Set(
    items.filter((i) => i.resolved).map((i) => i.id)
  );

  doc.fixQueue = [...byId.values()]
    .filter((i) => !i.resolved || !resolvedIds.has(i.id))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, MAX_FIX_QUEUE);

  return doc;
}

function severityRank(sev) {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[sev] || 0;
}

function pushDailySummary(doc, summary) {
  doc.dailySummaries = [summary, ...(doc.dailySummaries || [])]
    .filter((s, idx, arr) => arr.findIndex((x) => x.date === s.date) === idx)
    .slice(0, MAX_DAILY);
  return doc;
}

function pushWeeklyReport(doc, report) {
  doc.weeklyReports = [report, ...(doc.weeklyReports || [])]
    .filter((r, idx, arr) => arr.findIndex((x) => x.weekOf === r.weekOf) === idx)
    .slice(0, MAX_WEEKLY);
  return doc;
}

function pushSnapshot(doc, snapshot) {
  doc.snapshots = [snapshot, ...(doc.snapshots || [])].slice(0, MAX_SNAPSHOTS);
  return doc;
}

function getLatestScores(doc) {
  return doc.scores || emptyDoc().scores;
}

function getTodaySummary(doc) {
  const today = new Date().toISOString().slice(0, 10);
  return (doc.dailySummaries || []).find((s) => s.date === today) || null;
}

function getLatestWeekly(doc) {
  return (doc.weeklyReports || [])[0] || null;
}

module.exports = {
  DATA_PATH,
  emptyDoc,
  readDoc,
  writeDoc,
  upsertFixQueue,
  pushDailySummary,
  pushWeeklyReport,
  pushSnapshot,
  getLatestScores,
  getTodaySummary,
  getLatestWeekly
};
