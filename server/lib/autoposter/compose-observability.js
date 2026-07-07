/**
 * G2 - Compose probe and failure log for Post Studio operators.
 */
const { listComposeSkips } = require('./compose-skip-log');
const eliteRecruiting = require('./elite-recruiting-compose');

function deriveComposeRouting(probe = {}) {
  const elite = probe.eliteBuild || {};
  if (elite.ok && probe.publishGate) return 'elite';
  if (elite.ok && probe.publishGate === false) return 'qa_blocked';
  if (elite.reason === 'elite_enrich_exhausted' || elite.lastReason) {
    return 'archived_with_gaps';
  }
  if (probe.publishGate === false) return 'archived_with_gaps';
  return 'pending';
}

async function listComposeFailureReport({ slug = null, limit = 50 } = {}) {
  return {
    ok: true,
    pr789Only: eliteRecruiting.isPr789OnlyRecruiting(),
    eliteComposeEnabled:
      typeof eliteRecruiting.eliteRecruitingComposeEnabled === 'function'
        ? eliteRecruiting.eliteRecruitingComposeEnabled()
        : process.env.X_AUTOPOST_ELITE_RECRUITING_COMPOSE !== 'false',
    entries: listComposeSkips({ slug, limit })
  };
}

async function composeProbe(slug, opts = {}) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'missing_slug' };

  const { probeIntelAutoposterPath } = require('../x-autoposter-fill');
  let probe;
  try {
    probe = await probeIntelAutoposterPath(normalized, opts);
  } catch (err) {
    probe = {
      ok: false,
      slug: normalized,
      error: err?.message || String(err),
      fuse: null,
      eliteBuild: { ok: false, reason: 'probe_error' }
    };
  }
  const elite = probe.eliteBuild || {};
  const routing = deriveComposeRouting(probe);

  return {
    ok: true,
    slug: normalized,
    routing,
    fuse: probe.fuse || null,
    eliteBuild: elite,
    dominantAngle: elite.dominantAngle || null,
    composePath: elite.composePath || null,
    angleReason: elite.angleReason || null,
    publishGate: probe.publishGate ?? null,
    publishGateReason: probe.publishGateReason || null,
    build: probe.build || null,
    resolution: probe.resolution || null,
    tier: probe.tier || null,
    eligibility: probe.eligibility || null,
    intelRowCount: probe.intelRowCount ?? null,
    on3Row: probe.on3Row || null,
    probe
  };
}

module.exports = {
  deriveComposeRouting,
  listComposeFailureReport,
  composeProbe
};