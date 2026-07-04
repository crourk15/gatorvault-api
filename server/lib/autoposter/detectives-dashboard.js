/** Detectives pile dashboard — admin visibility for beat intel research queue. */
const store = require('./detectives-store');
const handoff = require('./detectives-handoff');
const { detectivesEnabled } = require('./detectives');

function lastLogPhase(log, phase) {
  const rows = (log || []).filter((l) => l.phase === phase);
  return rows.length ? rows[rows.length - 1] : null;
}

function nextPhaseHint(status, lastPhase) {
  if (status !== 'investigating') return null;
  if (!lastPhase || lastPhase === 'start') return 'identity lookup';
  if (lastPhase === 'identity') return 'platform provisioning (Hub + intel row)';
  if (lastPhase === 'platform') return 'metrics repair (rpm / visit / comp)';
  if (lastPhase === 'repair') return 'voice promote (detectiveOverride)';
  if (lastPhase === 'promote') return 'research strategies';
  if (lastPhase === 'strategies') return 'compose / enqueue attempts';
  if (lastPhase === 'reject') return 'retry next strategy';
  return 'investigating';
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
  const lastPhase = lastEntry?.phase || null;
  const investigatingMs = caseItem.status === 'investigating'
    ? Date.now() - new Date(caseItem.updatedAt || caseItem.createdAt).getTime()
    : 0;
  const diagnosis = caseItem.diagnosis || null;
  return {
    id: caseItem.id,
    status: caseItem.status,
    skipReason: caseItem.skipReason,
    skipReasonRaw: caseItem.skipReasonRaw || caseItem.skipReason,
    skipStage: caseItem.skipStage,
    skipCode: diagnosis?.primaryCode || caseItem.finalSkipCode || caseItem.skipReason || null,
    finalSkipCode: caseItem.finalSkipCode || diagnosis?.primaryCode || null,
    salvageable: diagnosis?.salvageable ?? null,
    beatKind: diagnosis?.beatKind || null,
    gaps: diagnosis?.gaps || [],
    diagnosis,
    metrics: hints.metrics || null,
    repairActions: (caseItem.repairActions || []).slice(-6),
    voicePromoted: (caseItem.investigationLog || []).some((l) => l.phase === 'promote' && l.ok === true),
    createdAt: caseItem.createdAt,
    updatedAt: caseItem.updatedAt,
    attempts: caseItem.attempts,
    maxAttempts: caseItem.maxAttempts,
    priority: handoff.casePriority(caseItem),
    lastPhase,
    nextPhase: nextPhaseHint(caseItem.status, lastPhase),
    investigatingMinutes: investigatingMs > 0 ? Math.round(investigatingMs / 60000) : 0,
    stuckInvestigating: caseItem.status === 'investigating' && investigatingMs > 3 * 60 * 1000,
    lastReject: rejectLog?.reason || null,
    playerName: identityLog?.playerName || cand.playerName || hints.playerName || null,
    playerSlug: identityLog?.playerSlug || cand.playerSlug || hints.playerSlug || null,
    platformProvisioned: platformLog?.provisioned ?? null,
    platformIntelCreated: platformLog?.intelCreated ?? null,
    platformOk: platformLog?.ok ?? null,
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

function getBeatCacheHealth() {
  try {
    const { getBeatPosts } = require('../live-beat');
    const beat = getBeatPosts(1);
    const posts = beat?.posts || [];
    return {
      postCount: posts.length,
      fetchedAt: beat?.fetchedAt || null,
      error: beat?.error || null,
      tokenConfigured: !!(beat?.tokenStatus?.configured),
      tokenOk: !!(beat?.tokenStatus?.ok),
    };
  } catch (err) {
    return { postCount: 0, fetchedAt: null, error: err.message, tokenConfigured: false, tokenOk: false };
  }
}

function getDetectivesDashboard({ status = null, limit = 50 } = {}) {
  try { store.recoverStaleInvestigatingCases(); } catch {}
  const doc = store.loadPile();
  const counts = store.countByStatus();
  const usePriority = !status || status === 'pending';
  const rows = store.listCases({
    status,
    limit: Math.min(100, limit || 50),
    priority: usePriority,
  });
  const investigating = store.listCases({ status: 'investigating', limit: 10 });
  const totalCases = (doc.cases || []).length;
  const beatCache = getBeatCacheHealth();
  const lastBackfill = doc.lastBackfill || null;
  let pileHint = null;
  if (totalCases === 0) {
    pileHint = 'Pile is empty — Render disk resets on deploy. Scan beat cache rebuilds from filter skips, ops logs, and needs_resolution intel.';
    if (beatCache.postCount === 0 && beatCache.error) {
      pileHint += ' Beat cache issue: ' + beatCache.error;
    } else if (lastBackfill && (lastBackfill.created || 0) === 0 && (lastBackfill.scanned || 0) > 0) {
      pileHint += ' Last scan found ' + lastBackfill.scanned + ' candidate(s) but none were handoff-eligible (often class_year_below_2027 or no_player_name).';
    }
  }
  return {
    enabled: detectivesEnabled(),
    updatedAt: doc.updatedAt,
    counts,
    totalCases,
    pileHint,
    beatCache,
    lastBackfill,
    activeInvestigation: investigating.length
      ? { caseId: investigating[0].id, playerName: formatCaseForDashboard(investigating[0]).playerName, lastPhase: formatCaseForDashboard(investigating[0]).lastPhase, nextPhase: formatCaseForDashboard(investigating[0]).nextPhase }
      : null,
    cases: rows.map(formatCaseForDashboard),
  };
}

module.exports = { getDetectivesDashboard, formatCaseForDashboard };