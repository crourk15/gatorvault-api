/**
 * QA run history + uptime persistence.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'ops');
const RUNS_PATH = path.join(DATA_DIR, 'qa-runs.json');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'qa-screenshots');
const MAX_RUNS = 100;
const MAX_ERRORS = 50;

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(RUNS_PATH, 'utf8'));
  } catch {
    return {
      version: 1,
      uptime: { since: new Date().toISOString(), checks: 0, successes: 0 },
      lastRun: null,
      runs: [],
      errors: [],
      moduleStatus: {}
    };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(RUNS_PATH, JSON.stringify(doc, null, 2));
}

function recordRun(run) {
  const doc = readDoc();
  doc.uptime.checks += 1;
  if (run.pass) doc.uptime.successes += 1;
  doc.lastRun = {
    id: run.id,
    at: run.finishedAt,
    pass: run.pass,
    durationMs: run.durationMs,
    failed: run.summary?.failed || 0
  };

  doc.runs.unshift(run);
  if (doc.runs.length > MAX_RUNS) doc.runs.length = MAX_RUNS;

  const moduleStatus = {};
  Object.entries(run.modules || {}).forEach(([key, mod]) => {
    moduleStatus[key] = {
      pass: mod.pass,
      total: mod.total,
      failed: mod.failed,
      at: run.finishedAt
    };
  });
  doc.moduleStatus = moduleStatus;

  const newErrors = (run.errors || []).map((e) => ({
    id: `qe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: run.finishedAt,
    runId: run.id,
    ...e
  }));
  doc.errors = [...newErrors, ...(doc.errors || [])].slice(0, MAX_ERRORS);
  writeDoc(doc);
  return doc;
}

function getDashboard() {
  const doc = readDoc();
  const uptimePct =
    doc.uptime.checks > 0 ? Math.round((doc.uptime.successes / doc.uptime.checks) * 1000) / 10 : 100;
  return {
    uptime: { ...doc.uptime, percent: uptimePct },
    lastRun: doc.lastRun,
    moduleStatus: doc.moduleStatus,
    recentRuns: (doc.runs || []).slice(0, 20),
    errors: (doc.errors || []).slice(0, 50),
    updatedAt: doc.updatedAt || null
  };
}

function saveScreenshot(filename, buffer) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const full = path.join(SCREENSHOTS_DIR, safe);
  fs.writeFileSync(full, buffer);
  return { path: full, filename: safe };
}

function getScreenshotPath(filename) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const full = path.join(SCREENSHOTS_DIR, safe);
  return fs.existsSync(full) ? full : null;
}

module.exports = {
  readDoc,
  recordRun,
  getDashboard,
  saveScreenshot,
  getScreenshotPath,
  SCREENSHOTS_DIR
};
