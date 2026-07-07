/**
 * Detectives Engine v2 elite compose — shared PR-789 path for case resolution.
 */
const eliteRecruiting = require('./elite-recruiting-compose');
const qa = require('./recruiting-post-qa');

function intelRowFromHints(slug, hints = {}, identity = {}) {
  const beatText = String(hints.beatText || '').trim();
  if (!beatText) return null;
  return {
    detail: beatText,
    skinny: beatText,
    playerName: identity.playerName || hints.playerName || null,
    playerSlug: slug,
    classYear: identity.classYear || hints.classYear || null,
    pos: identity.pos || hints.pos || null
  };
}

function composeMeta(composed = {}) {
  const meta = composed.validationMeta || {};
  return {
    dominantAngle: meta.dominantAngle || null,
    composePath: meta.composePath || meta.eliteComposePath || null,
    angleReason: meta.angleReason || meta.dominantAngleReason || null
  };
}

function archivedWithGaps(payload = {}) {
  return {
    outcome: 'archived_with_gaps',
    ok: false,
    ...payload
  };
}

async function composeDetectivesEliteCase({
  slug,
  hints = {},
  identity = {},
  fused: prefused = null,
  opts = {}
} = {}) {
  const normalized = String(slug || identity.playerSlug || '').trim().toLowerCase();
  if (!normalized) {
    return archivedWithGaps({ reason: 'missing_slug', fused: prefused, qa: { pass: false, reason: 'missing_slug' } });
  }

  const built = await eliteRecruiting.buildEliteRecruitingPost(normalized, {
    hints,
    intelRow: opts.intelRow || intelRowFromHints(normalized, hints, identity),
    metrics: opts.metrics || hints.metrics || null,
    research: opts.research || null,
    trigger: opts.trigger || 'detectives_elite_compose'
  });

  if (!built?.ok || !built.text) {
    return archivedWithGaps({
      reason: built?.reason || 'compose_failed',
      lastReason: built?.lastReason || null,
      enrichPassesTried: built?.enrichPassesTried || [],
      gaps: built?.gaps || built?.fused?.gaps || [],
      fused: built?.fused || prefused,
      composed: built || null,
      qa: { pass: false, reason: built?.reason || 'compose_failed' },
      ...composeMeta(built || {})
    });
  }

  const gate = eliteRecruiting.passesEliteRecruitingGate(built, normalized);
  const candidate = eliteRecruiting.toQueueCandidate(built, normalized, {
    detectivesPath: 'elite_fused',
    enrichPass: built.enrichPass,
    enrichmentSources: built.enrichmentSources
  });
  if (candidate?.validationMeta) {
    candidate.validationMeta.detectivesPath = 'elite_fused';
    candidate.validationMeta.detectivesEliteCompose = true;
  }

  if (!gate.ok) {
    return archivedWithGaps({
      reason: gate.reason,
      violations: gate.violations || null,
      composed: built,
      candidate,
      fused: built.fused || prefused,
      qa: { pass: false, reason: gate.reason },
      ...composeMeta(built)
    });
  }

  if (!qa.passesPublishGate(candidate)) {
    const reject = qa.rejectReason(candidate) || 'recruiting_qa';
    return archivedWithGaps({
      reason: reject,
      composed: built,
      candidate,
      fused: built.fused || prefused,
      qa: { pass: false, reason: reject },
      ...composeMeta(built)
    });
  }

  return {
    outcome: 'elite',
    ok: true,
    composed: built,
    candidate,
    fused: built.fused || prefused,
    qa: { pass: true, reason: null },
    ...composeMeta(built)
  };
}

module.exports = {
  composeDetectivesEliteCase,
  intelRowFromHints,
  composeMeta
};