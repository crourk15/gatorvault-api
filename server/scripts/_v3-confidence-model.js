/**
 * Self-Runner v3 — Confidence model (0-100 per playbook).
 */
const fs = require('fs');
const path = require('path');
const { allPlaybooks } = require('./playbook-registry');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const CONFIDENCE_PATH = path.join(SERVER_ROOT, 'data', 'ops', 'self-runner-confidence.json');
const DEFAULT = 50;

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(CONFIDENCE_PATH, 'utf8'));
  } catch {
    return { version: 3, playbooks: {}, events: [] };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(CONFIDENCE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIDENCE_PATH, JSON.stringify(doc, null, 2));
}

function getConfidenceBand(score) {
  if (score < 40) return 'never_auto';
  if (score < 70) return 'propose_only';
  if (score < 90) return 'guarded_auto';
  return 'fully_trusted';
}

function getPlaybookConfidence(id) {
  return readDoc().playbooks[id]?.score ?? DEFAULT;
}

function adjustConfidence(playbookId, delta, reason, meta = {}) {
  const doc = readDoc();
  if (!doc.playbooks[playbookId]) doc.playbooks[playbookId] = { score: DEFAULT, history: [] };
  const prev = doc.playbooks[playbookId].score;
  const next = Math.max(0, Math.min(100, prev + delta));
  doc.playbooks[playbookId].score = next;
  doc.playbooks[playbookId].history.unshift({ at: new Date().toISOString(), prev, next, delta, reason, ...meta });
  doc.playbooks[playbookId].history = doc.playbooks[playbookId].history.slice(0, 100);
  doc.events = doc.events || [];
  doc.events.unshift({ at: new Date().toISOString(), playbookId, delta, reason, score: next, ...meta });
  doc.events = doc.events.slice(0, 500);
  writeDoc(doc);
  return { prev, next, band: getConfidenceBand(next) };
}

function recordLearningEvent(event) {
  const deltas = {
    fix_succeeded: 8,
    qa_passed: 5,
    health_improved: 6,
    coder_approved: 10,
    fix_failed: -12,
    qa_failed: -10,
    health_dropped: -15,
    coder_rejected: -8,
    rollback: -20
  };
  const reason = event.outcome || event.coderAction;
  const delta = deltas[reason] ?? 0;
  if (!delta || !event.playbookId) return null;
  return adjustConfidence(event.playbookId, delta, reason, event);
}

function getAllScores() {
  const doc = readDoc();
  return allPlaybooks().map((pb) => {
    const score = doc.playbooks[pb.id]?.score ?? DEFAULT;
    return { playbookId: pb.id, label: pb.label, fixType: pb.fixType, score, band: getConfidenceBand(score) };
  });
}

module.exports = {
  CONFIDENCE_PATH,
  getPlaybookConfidence,
  getConfidenceBand,
  adjustConfidence,
  recordLearningEvent,
  getAllScores
};
