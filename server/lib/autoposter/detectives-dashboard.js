/** Detectives pile dashboard — admin visibility for beat intel research queue. */
const store = require('./detectives-store');
const { detectivesEnabled } = require('./detectives');

function formatCaseForDashboard(caseItem) {
  const beat = caseItem?.beatPost || {};
  const cand = caseItem?.candidate || {};
  const hints = caseItem?.hints || {};
  const beatText = String(beat.text || beat.summary || cand.beatText || cand.text || hints.beatText || '').trim();
  const identityLog = (caseItem.investigationLog || []).find((l) => l.phase === 'identity');
  const platformLog = (caseItem.investigationLog || []).find((l) => l.phase === 'platform');
  return {
    id: caseItem.id,
    status: caseItem.status,
    skipReason: caseItem.skipReason,
    skipStage: caseItem.skipStage,
    createdAt: caseItem.createdAt,
    updatedAt: caseItem.updatedAt,
    attempts: caseItem.attempts,
    maxAttempts: caseItem.maxAttempts,
    playerName: identityLog?.playerName || cand.playerName || hints.playerName || null,
    playerSlug: identityLog?.playerSlug || cand.playerSlug || hints.playerSlug || null,
    writerName: beat.writerName || hints.writerName || null,
    beatHandle: beat.handle || hints.handle || null,
    beatText: beatText.slice(0, 280),
    beatUrl: beat.url || null,
    hasFutureCastContext: platformLog?.hasFutureCastContext ?? null,
    platformUrl: platformLog?.url || null,
    resolvedPath: caseItem.resolvedPath || null,
    queueItemId: caseItem.queueItemId || null,
    resolvedAt: caseItem.resolvedAt || null,
    resolvedPreview: caseItem.resolvedCandidate?.text || null,
    log: (caseItem.investigationLog || []).slice(-8),
  };
}

function getDetectivesDashboard({ status = null, limit = 50 } = {}) {
  const doc = store.loadPile();
  const counts = store.countByStatus();
  const rows = store.listCases({ status, limit: Math.min(100, limit || 50) });
  return {
    enabled: detectivesEnabled(),
    updatedAt: doc.updatedAt,
    counts,
    cases: rows.map(formatCaseForDashboard),
  };
}

module.exports = { getDetectivesDashboard, formatCaseForDashboard };
