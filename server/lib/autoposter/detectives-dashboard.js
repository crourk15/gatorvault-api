/** Detectives pile dashboard — admin visibility for beat intel research queue. */
const store = require('./detectives-store');
const handoff = require('./detectives-handoff');
const { detectivesEnabled } = require('./detectives');

function lastLogPhase(log, phase) {
  const rows = (log || []).filter((l) => l.phase === phase);
  return rows.length ? rows[rows.length - 1] : null;
}

function formatCaseForDashboard(caseItem) {
  const beat = caseItem?.beatPost || {};
  const cand = caseItem?.candidate || {};
  const hints = caseItem?.hints || {};
  const beatText = String(beat.text || beat.summary || cand.beatText || cand.text || hints.beatText || '').trim();
  const log = caseItem.investigationLog || [];
  const identityLog = lastLogPhase(log, 'identity');
  const platformLog = lastLogPhase(log, 'platform');
  const rejectLog = lastLogPhase(log, 'reject');
  const lastEntry = log.length ? log[log.length - 1] : null;
  return {
    id: caseItem.id,
    status: caseItem.status,
    skipReason: caseItem.skipReason,
    skipStage: caseItem.skipStage,
    createdAt: caseItem.createdAt,
    updatedAt: caseItem.updatedAt,
    attempts: caseItem.attempts,
    maxAttempts: caseItem.maxAttempts,
    priority: handoff.casePriority(caseItem),
    lastPhase: lastEntry?.phase || null,
    lastReject: rejectLog?.reason || null,
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
    log: log.slice(-8),
  };
}

function getDetectivesDashboard({ status = null, limit = 50 } = {}) {
  const doc = store.loadPile();
  const counts = store.countByStatus();
  const usePriority = !status || status === 'pending';
  const rows = store.listCases({
    status,
    limit: Math.min(100, limit || 50),
    priority: usePriority,
  });
  return {
    enabled: detectivesEnabled(),
    updatedAt: doc.updatedAt,
    counts,
    cases: rows.map(formatCaseForDashboard),
  };
}

module.exports = { getDetectivesDashboard, formatCaseForDashboard };
