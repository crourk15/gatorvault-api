/**
 * Self-Runner failure log — server/data/ops/self-runner-failures.json
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'ops', 'self-runner-failures.json');
const MAX_ENTRIES = 100;

function emptyDoc() {
  return { version: 1, updatedAt: null, failures: [] };
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

function logFailure(entry) {
  const doc = readDoc();
  const record = {
    id: `srf_${Date.now()}`,
    timestamp: new Date().toISOString(),
    runId: entry.runId || null,
    fixId: entry.fixId || null,
    checkId: entry.checkId || null,
    reason: entry.reason || null,
    expected: entry.expected || null,
    actual: entry.actual || null,
    correctivePatch: entry.correctivePatch || null,
    failureReport: entry.failureReport || null,
    phase: entry.phase || 'validate'
  };
  doc.failures = [record, ...(doc.failures || [])].slice(0, MAX_ENTRIES);
  writeDoc(doc);
  return record;
}

function listFailures(limit = 20) {
  return (readDoc().failures || []).slice(0, limit);
}

module.exports = {
  DATA_PATH,
  readDoc,
  writeDoc,
  logFailure,
  listFailures
};
