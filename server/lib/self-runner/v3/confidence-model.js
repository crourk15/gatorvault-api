/**
 * Self-Runner v3 — Playbook confidence scoring (0–100).
 */
const fs = require('fs');
const path = require('path');
const { getPlaybook, allPlaybooks } = require('./playbook-registry');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..');
const CONFIDENCE_PATH = path.join(SERVER_ROOT, 'data', 'ops', 'self-runner-confidence.json');

const DEFAULT_CONFIDENCE = 50;

function readConfidenceDoc() {
  try {
    return JSON.parse(fs.readFileSync(CONFIDENCE_PATH, 'utf8'));
  } catch {
    return {
      version: 3,
      updatedAt: null,
      playbooks: {},
      subsystemTrust: {},
      events: []
    };
  }
}

function writeConfidenceDoc(doc) {
  fs.mkdirSync(path.dirname(CONFIDENCE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIDENCE_PATH, JSON.stringify(doc, null, 2));
}

function getPlaybookConfidence(playbookId) {
  const doc = readConfidenceDoc();
  return doc.playbooks[playbookId]?.score ?? DEFAULT_CONFIDENCE;
}

function getConfidenceBand(score) {
  if (score < 40) return 'never_auto';
  if (score < 70) return 'propose_only';
  if (score < 90) return 'guarded_auto';
  return 'fully_trusted';
}

function adjustConfidence(playbookId, delta, reason, meta = {}) {
  const doc = readConfidenceDoc();
  if (!doc.playbooks[playbookId]) {
    doc.playbooks[playbookId] = { score: DEFAULT_CONFIDENCE, history: [] };
  }
  const prev = doc.playbooks[playbookId].score;
  const next = Math.max(0, Math.min(100, prev + delta));
  doc.playbooks[playbookId].score = next;
  doc.playbooks[playbookId].history.unshift({
    at: new Date().toISOString(),
    prev,
    next,
    delta,
    reason,
    ...meta
  });
  doc.playbooks[playbookId].history = doc.playbooks[playbookId].history.slice(0, 100);

  doc.events.unshift({
    at: new Date().toISOString(),
    playbookId,
    delta,
    reason,
    score: next,
    ...meta
  });
  doc.events = doc.events.slice(0, 500);

  writeConfidenceDoc(doc);
  return { prev, next, band: getConfidenceBand(next) };
}

function recordLearningEvent(event) {
  const { playbookId, outcome, coderAction } = event;
  if (!playbookId) return null;

  const deltas = {
    fix_succeeded: 8,
    qa_passed: 5,
    health_improved: 6,
    coder_approved: 10,
    coder_manual_similar: 7,
    fix_failed: -12,
    qa_failed: -10,
    health_dropped: -15,
    coder_rejected: -8,
    coder_different_fix: -5,
    rollback: -20
  };

  const reason = outcome || coderAction || 'unknown';
  const delta = deltas[reason] ?? 0;
  if (!delta) return null;

  return adjustConfidence(playbookId, delta, reason, {
    fixId: event.fixId,
    issueId: event.issueId,
    checkId: event.checkId
  });
}

function getAllConfidenceScores() {
  const doc = readConfidenceDoc();
  return allPlaybooks().map((pb) => {
    const score = doc.playbooks[pb.id]?.score ?? DEFAULT_CONFIDENCE;
    return {
      playbookId: pb.id,
      label: pb.label,
      fixType: pb.fixType,
      score,
      band: getConfidenceBand(score),
      autoHealMinConfidence: pb.autoHealMinConfidence,
      autoHealEligible: score >= (pb.autoHealMinConfidence ?? 90) && !pb.proposeOnly
    };
  });
}

function getSubsystemTrust() {
  const doc = readConfidenceDoc();
  const defaults = {
    autoposter: 60,
    recruiting: 55,
    portal: 55,
    cron: 70,
    feed: 80,
    'war-room': 50,
    film: 65
  };
  return { ...defaults, ...doc.subsystemTrust };
}

module.exports = {
  CONFIDENCE_PATH,
  DEFAULT_CONFIDENCE,
  readConfidenceDoc,
  getPlaybookConfidence,
  getConfidenceBand,
  adjustConfidence,
  recordLearningEvent,
  getAllConfidenceScores,
  getSubsystemTrust
};
