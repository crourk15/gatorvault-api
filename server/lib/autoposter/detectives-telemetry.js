/**
 * G2 - Structured Detectives telemetry for ops visibility.
 */
function buildDetectivesTelemetry(d = {}) {
  const phase = d.phase || null;
  const ok = !!d.ok;
  return {
    subsystem: 'autoposter:detectives',
    status: ok ? 'success' : d.status || 'skipped',
    message: d.message || (ok ? 'detectives:resolved' : `detectives:${phase || 'event'}`),
    details: {
      ok,
      caseId: d.caseId || null,
      phase,
      path: d.path || null,
      playerSlug: d.playerSlug || null,
      skipReason: d.skipReason || null,
      primaryCode: d.primaryCode || null,
      archiveReason: d.archiveReason || null,
      attempts: d.attempts ?? null,
      gaps: Array.isArray(d.gaps) ? d.gaps : [],
      compose: d.compose || null,
      fuse: d.fuse || null,
      enrichPassesTried: d.enrichPassesTried || [],
      enrichmentSources: d.enrichmentSources || [],
      lastReason: d.lastReason || null,
      beatDrivenOnly: d.beatDrivenOnly ?? null,
      preFlight: d.preFlight ?? null,
      afterPlatform: d.afterPlatform ?? null
    }
  };
}

function emitDetectivesTelemetry(d = {}) {
  const payload = buildDetectivesTelemetry(d);
  try {
    require('../ops-monitor').logEvent(payload);
  } catch {
    /* optional */
  }
  return payload;
}

module.exports = { buildDetectivesTelemetry, emitDetectivesTelemetry };