/**
 * Self-healing autoposter — auto-republish when elite stack drifts or prior send was sub-elite.
 */
const resolutionLedger = require('./player-resolution-ledger');
const eliteFingerprintLedger = require('./elite-fingerprint-ledger');
const {
  fingerprintFromEliteResult,
  fingerprintFromProbe,
  eliteFingerprintDrift,
  isSubElitePreview,
  ELITE_COMPOSE_PATH
} = require('./elite-build-fingerprint');

function selfHealEnabled() {
  return process.env.X_AUTOPOST_SELF_HEAL !== 'false';
}

function selfHealAutoPost() {
  return process.env.X_AUTOPOST_SELF_HEAL_AUTO_POST === 'true';
}

async function buildCurrentEliteFingerprint(slug, opts = {}) {
  const {
    buildEliteRepublishPost,
    serializeProbeEliteBuild
  } = require('../player-intelligence/elite-republish-compose');
  const intelStore = require('../recruiting-intel-store');
  await intelStore.initIntelStore().catch(() => {});

  const normalized = String(slug || '')
    .trim()
    .toLowerCase();
  const rows = intelStore.getIntelForPlayer({ playerSlug: normalized }) || [];
  const on3Row =
    rows.find((row) => /on3-team-news/i.test(String(row.source || ''))) ||
    rows.find((row) => /beat|on3/i.test(String(row.source || ''))) ||
    null;
  if (!on3Row) {
    return { ok: false, reason: 'no_intel_row', slug: normalized };
  }

  const built = await buildEliteRepublishPost(normalized, {
    intelRow: on3Row,
    refreshOn3: opts.refreshOn3 !== false,
    persistFusion: opts.persistFusion !== false,
    _testSkipRefresh: opts._testSkipRefresh === true
  });

  if (!built?.ok) {
    return {
      ok: false,
      reason: built?.reason || 'elite_compose_failed',
      slug: normalized,
      elite: built,
      probe: serializeProbeEliteBuild(built)
    };
  }

  const fingerprint = fingerprintFromEliteResult(built);
  return {
    ok: true,
    slug: normalized,
    on3Row,
    built,
    probe: serializeProbeEliteBuild(built),
    fingerprint
  };
}

async function assessSelfHealCandidate(slug, opts = {}) {
  const normalized = String(slug || '')
    .trim()
    .toLowerCase();
  if (!normalized) return { ok: false, reason: 'missing_slug' };

  const { resolveCoverageTier } = require('../player-intelligence/tiers');
  const tier = await resolveCoverageTier(normalized);
  if (tier !== 'A' && tier !== 'B') {
    return { ok: true, slug: normalized, tier, needsHeal: false, reason: 'not_tier_ab' };
  }

  const resolution = resolutionLedger.getPlayerResolution(normalized);
  const resolutionCheck = resolutionLedger.checkPlayerResolution(normalized);
  const stored = eliteFingerprintLedger.getEliteFingerprint(normalized);
  const current = await buildCurrentEliteFingerprint(normalized, opts);

  if (!current.ok) {
    return {
      ok: true,
      slug: normalized,
      tier,
      needsHeal: false,
      reason: current.reason,
      resolution,
      resolutionBlocked: resolutionCheck.blocked,
      stored,
      current: null,
      health: { status: 'degraded', code: current.reason }
    };
  }

  const drift = eliteFingerprintDrift(stored, current.fingerprint);
  const subEliteResolution =
    resolution?.resolution === resolutionLedger.RESOLVED_PUBLISH &&
    isSubElitePreview(resolution.preview);
  const blockedDuplicate = resolutionCheck.blocked && resolutionCheck.reason === 'duplicate_already_sent';
  const needsHeal =
    current.fingerprint.ok &&
    (drift.drift || subEliteResolution || (blockedDuplicate && !stored?.ok));

  let healReason = null;
  if (subEliteResolution) healReason = 'sub_elite_prior_send';
  else if (drift.drift) healReason = drift.reason;
  else if (blockedDuplicate && !stored?.ok) healReason = 'blocked_without_elite_fingerprint';

  return {
    ok: true,
    slug: normalized,
    tier,
    needsHeal,
    healReason,
    drift,
    subEliteResolution,
    resolution,
    resolutionBlocked: resolutionCheck.blocked,
    stored,
    current: {
      fingerprint: current.fingerprint,
      probe: current.probe,
      preview: String(current.built?.text || '').slice(0, 200)
    },
    health: needsHeal
      ? { status: 'needs_heal', code: healReason, composePath: ELITE_COMPOSE_PATH }
      : { status: 'healthy', code: 'elite_stack_current' }
  };
}

async function runSelfHealForSlug(slug, opts = {}) {
  if (!selfHealEnabled()) {
    return { ok: false, reason: 'self_heal_disabled', slug };
  }

  const assessment = await assessSelfHealCandidate(slug, opts);
  if (!assessment.needsHeal) {
    return {
      ok: true,
      healed: false,
      slug: assessment.slug,
      reason: assessment.healReason || assessment.reason || 'no_heal_needed',
      assessment
    };
  }

  const { republishPlayerIntel } = require('../x-autoposter-fill');
  const post = opts.post === true || (opts.post !== false && selfHealAutoPost());
  const republish = await republishPlayerIntel(slug, {
    post,
    fingerprint: opts.fingerprint || null,
    selfHeal: true,
    healReason: assessment.healReason
  });

  if (republish?.ok && republish.enqueued) {
    const fp = fingerprintFromEliteResult({
      validationMeta: republish.enqueued.validationMeta,
      templateBlocks: republish.enqueued.templateBlocks
    });
    eliteFingerprintLedger.recordEliteFingerprint(slug, fp, {
      source: 'self_heal',
      queueItemId: republish.enqueued.id || null,
      intelFingerprint: republish.enqueued.intelFingerprint || null
    });
  }

  try {
    const monitoring = require('./autoposter-monitoring');
    monitoring.logAutoposterEvent('self_heal', {
      slug,
      healed: !!republish?.ok,
      healReason: assessment.healReason,
      post,
      composePath: republish?.composePath || null,
      error: republish?.error || null
    });
  } catch {
    /* optional */
  }

  return {
    ok: !!republish?.ok,
    healed: !!republish?.ok,
    slug,
    healReason: assessment.healReason,
    assessment,
    republish
  };
}

async function listTierAbHealCandidates({ limit = 12 } = {}) {
  const intelStore = require('../recruiting-intel-store');
  const { resolveCoverageTier } = require('../player-intelligence/tiers');
  await intelStore.initIntelStore().catch(() => {});

  const slugs = new Set();
  const resolutionDoc = resolutionLedger.loadLedger();
  for (const [slug, row] of Object.entries(resolutionDoc.players || {})) {
    if (row.resolution === resolutionLedger.RESOLVED_PUBLISH) slugs.add(slug);
    if (row.resolution === resolutionLedger.RESOLVED_ARCHIVE && row.archiveReason === 'duplicate_already_sent') {
      slugs.add(slug);
    }
  }

  try {
    const unqueued = intelStore.getUnqueuedIntel({ maxAgeMs: 14 * 24 * 60 * 60 * 1000 }) || [];
    for (const row of unqueued) {
      if (row.playerSlug) slugs.add(String(row.playerSlug).toLowerCase());
    }
    const all = intelStore.getIntelForPlayer ? [] : [];
    void all;
  } catch {
    /* optional */
  }

  const tierMatches = [];
  for (const slug of slugs) {
    const tier = await resolveCoverageTier(slug);
    if (tier === 'A' || tier === 'B') tierMatches.push(slug);
  }

  tierMatches.sort();
  return tierMatches.slice(0, Math.max(1, Number(limit) || 12));
}

async function scanSelfHealCandidates(opts = {}) {
  const limit = Number(opts.limit || process.env.X_AUTOPOST_SELF_HEAL_SCAN_LIMIT || 8);
  const slugs = opts.slugs || (await listTierAbHealCandidates({ limit: limit * 2 }));
  const assessments = [];
  for (const slug of slugs) {
    if (assessments.length >= limit) break;
    const assessment = await assessSelfHealCandidate(slug, opts);
    assessments.push(assessment);
  }
  const needsHeal = assessments.filter((row) => row.needsHeal);
  return {
    ok: true,
    scanned: assessments.length,
    needsHealCount: needsHeal.length,
    assessments,
    needsHeal
  };
}

let _lastSelfHealRunAt = 0;

function selfHealThrottleMs() {
  return parseInt(process.env.X_AUTOPOST_SELF_HEAL_THROTTLE_MS || String(5 * 60 * 1000), 10);
}

function selfHealThrottled() {
  const ms = selfHealThrottleMs();
  if (ms <= 0) return false;
  return Date.now() - _lastSelfHealRunAt < ms;
}

async function runSelfHealScan(opts = {}) {
  if (!selfHealEnabled()) {
    return { ok: true, skipped: true, reason: 'self_heal_disabled' };
  }
  if (opts.force !== true && selfHealThrottled()) {
    return { ok: true, skipped: true, reason: 'self_heal_throttled' };
  }

  const dryRun = opts.dryRun === true;
  if (opts.slug) {
    const assessment = await assessSelfHealCandidate(opts.slug, opts);
    const scan = {
      ok: true,
      scanned: 1,
      needsHealCount: assessment.needsHeal ? 1 : 0,
      assessments: [assessment],
      needsHeal: assessment.needsHeal ? [assessment] : []
    };
    if (dryRun || !assessment.needsHeal) {
      return { ok: true, dryRun, ...scan, healed: [], healedCount: 0 };
    }
    const healed = [await runSelfHealForSlug(opts.slug, opts)];
    _lastSelfHealRunAt = Date.now();
    return {
      ok: true,
      dryRun: false,
      ...scan,
      healed,
      healedCount: healed.filter((row) => row.healed).length
    };
  }

  const scan = await scanSelfHealCandidates(opts);
  if (dryRun || !scan.needsHeal.length) {
    return {
      ok: true,
      dryRun,
      ...scan,
      healed: [],
      healedCount: 0
    };
  }

  const maxHeal = Number(opts.maxHeal || process.env.X_AUTOPOST_SELF_HEAL_MAX_PER_TICK || 2);
  const healed = [];
  for (const candidate of scan.needsHeal.slice(0, maxHeal)) {
    const out = await runSelfHealForSlug(candidate.slug, opts);
    healed.push(out);
  }

  _lastSelfHealRunAt = Date.now();

  return {
    ok: true,
    dryRun: false,
    ...scan,
    healed,
    healedCount: healed.filter((row) => row.healed).length
  };
}

async function runSelfHealHealthCheck(opts = {}) {
  const scan = await scanSelfHealCandidates({ ...opts, limit: opts.limit || 16 });
  const failures = scan.assessments.filter(
    (row) => row.health?.status === 'needs_heal' || row.health?.status === 'degraded'
  );
  const healthy = scan.assessments.filter((row) => row.health?.status === 'healthy');

  const loud = failures.length > 0;
  if (loud) {
    try {
      const opsMonitor = require('../ops-monitor');
      opsMonitor.logEvent({
        subsystem: 'autoposter:self-heal',
        status: 'warning',
        message: `Self-heal health: ${failures.length} player(s) need attention`,
        details: failures.slice(0, 5).map((row) => ({
          slug: row.slug,
          code: row.health?.code,
          tier: row.tier
        }))
      });
    } catch {
      /* optional */
    }
  }

  return {
    ok: failures.length === 0,
    healthy: healthy.length,
    failures: failures.length,
    scanned: scan.scanned,
    needsHeal: scan.needsHeal,
    assessments: scan.assessments,
    alerts: failures.map((row) => ({
      slug: row.slug,
      tier: row.tier,
      status: row.health?.status,
      code: row.health?.code,
      healReason: row.healReason,
      resolutionBlocked: row.resolutionBlocked,
      storedHash: row.stored?.hash || null,
      currentHash: row.current?.fingerprint?.hash || null
    }))
  };
}

module.exports = {
  selfHealEnabled,
  selfHealAutoPost,
  buildCurrentEliteFingerprint,
  assessSelfHealCandidate,
  runSelfHealForSlug,
  scanSelfHealCandidates,
  runSelfHealScan,
  runSelfHealHealthCheck,
  listTierAbHealCandidates
};
