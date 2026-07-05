/**
 * Detectives case resolution — publish or archive, never infinite pending.
 */
const store = require('./detectives-store');
const ledger = require('./player-resolution-ledger');
const preflight = require('./player-resolution-preflight');

function resolveCasePublish(caseItem, candidate, result = {}) {
  if (!caseItem?.id) return null;
  const slug = ledger.normalizeSlug(candidate?.playerSlug || caseItem?.hints?.playerSlug);
  const pathTag = candidate?.validationMeta?.detectivesPath || result.path || 'resolved';
  store.updateCase(caseItem.id, {
    status: ledger.RESOLVED_PUBLISH,
    resolvedAt: new Date().toISOString(),
    resolvedPath: pathTag,
    resolvedCandidate: require('./detectives-promote').buildResolvedCandidateSnapshot(candidate),
    queueItemId: result.item?.id || null,
    resolutionState: ledger.RESOLVED_PUBLISH
  });
  store.appendLog(caseItem.id, {
    phase: 'resolved_publish',
    path: pathTag,
    queueItemId: result.item?.id || null
  });
  if (slug) {
    ledger.markResolvedPublish(slug, {
      caseId: caseItem.id,
      queueItemId: result.item?.id || null,
      intelFingerprint: candidate?.intelFingerprint || null,
      source: 'detectives',
      preview: candidate?.text || null
    });
  }
  return store.getCase(caseItem.id);
}

function resolveCaseArchive(caseItem, archiveReason, meta = {}) {
  if (!caseItem?.id) return null;
  const slug = ledger.normalizeSlug(
    meta.playerSlug || caseItem?.hints?.playerSlug || caseItem?.candidate?.playerSlug
  );
  const reason =
    ledger.ARCHIVE_REASONS.includes(archiveReason) ? archiveReason : ledger.mapSkipCodeToArchiveReason(meta.skipCode, meta.skipReason);

  store.updateCase(caseItem.id, {
    status: ledger.RESOLVED_ARCHIVE,
    finalSkipCode: meta.skipCode || caseItem.finalSkipCode || reason,
    resolvedAt: new Date().toISOString(),
    resolvedPath: 'archived',
    resolutionState: ledger.RESOLVED_ARCHIVE,
    archiveReason: reason,
    diagnosis: meta.diagnosis || caseItem.diagnosis || null
  });
  store.appendLog(caseItem.id, {
    phase: 'resolved_archive',
    archiveReason: reason,
    skipCode: meta.skipCode || null,
    gaps: meta.diagnosis?.gaps || null
  });

  if (slug) {
    ledger.markResolvedArchive(slug, reason, {
      caseId: caseItem.id,
      source: meta.source || 'detectives',
      skipCode: meta.skipCode || null,
      committedTo: meta.committedTo || null,
      preview: meta.preview || null
    });
  }
  return store.getCase(caseItem.id);
}

async function preflightCase(caseItem, hints = {}) {
  const slug = ledger.normalizeSlug(hints.playerSlug || caseItem?.hints?.playerSlug);
  if (!slug) return { ok: true, action: 'enqueue' };
  return preflight.evaluatePlayerPostPreflight({
    playerSlug: slug,
    beatText: hints.beatText || null,
    intelFingerprint: caseItem?.candidate?.intelFingerprint || null
  });
}

function shouldStopInvestigation(caseItem) {
  if (!caseItem) return true;
  if (caseItem.status === 'failed_final') return true;
  return ledger.isTerminalCaseStatus(caseItem.status);
}

module.exports = {
  resolveCasePublish,
  resolveCaseArchive,
  preflightCase,
  shouldStopInvestigation
};
