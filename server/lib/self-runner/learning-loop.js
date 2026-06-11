/**
 * Self-Runner 2.0 — learning loop from approve/reject decisions.
 */
const fs = require('fs');
const path = require('path');
const logger = require('./self-runner-logger');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const FEEDBACK_PATH = path.join(SERVER_ROOT, 'data', 'ops', 'selfRunnerFeedback.json');

function readFeedback() {
  try {
    return JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));
  } catch {
    return {
      version: 1,
      updatedAt: null,
      accepted: [],
      rejected: [],
      patterns: {
        blockPlaceholderComments: true,
        preferMultiFilePatches: true,
        rejectedPatchTypes: [],
        acceptedPatchTypes: []
      }
    };
  }
}

function writeFeedback(doc) {
  fs.mkdirSync(path.dirname(FEEDBACK_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(doc, null, 2));
}

function recordDecision({ action, fix, reason }) {
  const doc = readFeedback();
  const entry = {
    at: new Date().toISOString(),
    action,
    fixId: fix?.id,
    patchType: fix?.patchType,
    checkId: fix?.checkId,
    files: fix?.filesToModify || fix?.patch?.edits?.map((e) => e.file) || [],
    reason: reason || null,
    hadPlaceholder: (fix?.patch?.edits || []).some((e) => /<!--\s*self-runner:/.test(e.text || ''))
  };

  if (action === 'approved' || action === 'completed') {
    doc.accepted.unshift(entry);
    if (doc.accepted.length > 500) doc.accepted.length = 500;
    if (entry.patchType && !doc.patterns.acceptedPatchTypes.includes(entry.patchType)) {
      doc.patterns.acceptedPatchTypes.push(entry.patchType);
    }
  } else if (action === 'rejected') {
    doc.rejected.unshift(entry);
    if (doc.rejected.length > 500) doc.rejected.length = 500;
    if (entry.patchType && !doc.patterns.rejectedPatchTypes.includes(entry.patchType)) {
      doc.patterns.rejectedPatchTypes.push(entry.patchType);
    }
    if (entry.hadPlaceholder) doc.patterns.blockPlaceholderComments = true;
    if (/placeholder/i.test(reason || '')) doc.patterns.blockPlaceholderComments = true;
  }

  writeFeedback(doc);
  logger.log.info('feedback_recorded', { action, fixId: entry.fixId, patchType: entry.patchType });
  return entry;
}

function shouldRejectPatchType(patchType) {
  const doc = readFeedback();
  const rejectCount = doc.rejected.filter((r) => r.patchType === patchType).length;
  const acceptCount = doc.accepted.filter((r) => r.patchType === patchType).length;
  if (doc.patterns.rejectedPatchTypes.includes(patchType) && rejectCount >= 2 && acceptCount === 0) {
    return true;
  }
  return false;
}

function blocksPlaceholderPatches() {
  return readFeedback().patterns?.blockPlaceholderComments !== false;
}

function getPatterns() {
  return readFeedback().patterns;
}

module.exports = {
  FEEDBACK_PATH,
  readFeedback,
  recordDecision,
  shouldRejectPatchType,
  blocksPlaceholderPatches,
  getPatterns
};
