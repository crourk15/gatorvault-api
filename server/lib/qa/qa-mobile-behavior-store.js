/**
 * Mobile Behavior QA — dedicated run history and structured issue log.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'ops');
const STORE_PATH = path.join(DATA_DIR, 'qa-mobile-behavior.json');
const MAX_RUNS = 60;
const MAX_ISSUES = 120;

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {
      version: 1,
      lastRun: null,
      runs: [],
      issues: []
    };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(doc, null, 2));
}

function recordRun(run) {
  const doc = readDoc();
  doc.lastRun = {
    id: run.id,
    at: run.finishedAt,
    pass: run.pass,
    durationMs: run.durationMs,
    viewport: run.viewport,
    failed: run.summary?.failed || 0,
    issueCount: (run.issues || []).length
  };

  doc.runs.unshift(run);
  if (doc.runs.length > MAX_RUNS) doc.runs.length = MAX_RUNS;

  const stamped = (run.issues || []).map((issue) => ({
    id: `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: run.finishedAt,
    runId: run.id,
    ...issue
  }));
  doc.issues = [...stamped, ...(doc.issues || [])].slice(0, MAX_ISSUES);
  writeDoc(doc);
  return doc;
}

function getDashboard() {
  const doc = readDoc();
  return {
    lastRun: doc.lastRun,
    recentRuns: (doc.runs || []).slice(0, 20),
    issues: (doc.issues || []).slice(0, 80),
    updatedAt: doc.updatedAt || null
  };
}

module.exports = {
  readDoc,
  recordRun,
  getDashboard,
  STORE_PATH
};
