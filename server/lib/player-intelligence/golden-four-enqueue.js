/**
 * Enqueue golden-four elite posts in board order — Drakeford → Robinson → Willingham.
 */
const intelStore = require('../recruiting-intel-store');
const eliteCaption = require('../x-autoposter-elite-caption');
const store = require('../x-autoposter-store');
const policy = require('../x-autoposter-policy');
const cadence = require('../x-autoposter-cadence');
const { validateBannedPhrases } = require('../autoposter/rewrite/fact-gates');
const { GOLDEN_FOUR_PROD_SLUGS } = require('./golden-four-on3');
const { syncGoldenFourPlayerFromOn3, refreshGoldenFourRankingCache } = require('./golden-four-on3');
const { composeGoldenFourFactPost } = require('./golden-four-compose');
const preflight = require('../autoposter/player-resolution-preflight');
const resolutionLedger = require('../autoposter/player-resolution-ledger');
const recruitingStore = require('../recruiting-store');

const DEFAULT_ORDER = Object.freeze([
  'ryan-drakeford',
  'man-robinson',
  'bryce-willingham',
  'merrick-ham'
]);

function pickBeatIntel(slug) {
  const rows = intelStore
    .getIntelForPlayer({ playerSlug: slug })
    .filter((row) => String(row.detail || row.skinny || '').trim())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const beatFirst =
    rows.find((row) => /beat|detectives|visit|target|unofficial|on3-team-news/i.test(String(row.source || ''))) ||
    rows[0];
  return beatFirst || null;
}

async function pickFusedBeatIntel(slug) {
  const { fusePlayerIntel } = require('./fuse-player-intel');
  const fused = await fusePlayerIntel(slug);
  if (!fused?.beatText) return null;
  const base = fused.primaryIntelRow || pickBeatIntel(slug) || {};
  return {
    ...base,
    playerName: fused.playerIntel?.identity?.name || base.playerName,
    playerSlug: slug,
    detail: fused.beatText,
    skinny: fused.beatText,
    _fusedIntel: fused
  };
}

function slugAlreadyPending(slug, items = []) {
  return items.some(
    (item) =>
      String(item.status || '').toLowerCase() === 'pending' &&
      String(item.playerSlug || '').toLowerCase() === slug
  );
}

async function composeGoldenFourPost(slug, intel, on3Sync, playerRow) {
  const factBuilt = composeGoldenFourFactPost({
    slug,
    intel,
    on3Sync,
    playerRow
  });
  if (factBuilt?.ok && factBuilt.text) {
    return factBuilt;
  }

  const voiceBuilt = await eliteCaption.buildElitePlayerPost({
    playerName: intel.playerName,
    playerSlug: slug,
    beatText: intel.detail || intel.skinny,
    intel: {
      ...intel,
      playerSlug: slug,
      playerName: intel.playerName,
      _forcePostFreshness: true
    },
    source: intel.source || 'golden-four-enqueue'
  });

  if (voiceBuilt?.ok && voiceBuilt.text) {
    const { PR6_FALLBACK_RE } = require('./golden-four-compose');
    if (PR6_FALLBACK_RE.test(voiceBuilt.text)) {
      return {
        ok: false,
        reason: 'pr6_fallback_blocked',
        factReason: factBuilt?.reason || null,
        voiceReason: 'pr6_template_detected'
      };
    }
  }

  return {
    ...(voiceBuilt || { ok: false }),
    reason: voiceBuilt?.reason || factBuilt?.reason || 'compose_failed',
    factReason: factBuilt?.reason || null
  };
}

function slugRecentlySent(slug, intelFingerprint = null) {
  try {
    const sentLedger = require('../x-autoposter-sent-ledger');
    const hit = sentLedger.hasRecentSentPost({ slug, playerSlug: slug, intelFingerprint });
    return hit.hit ? hit : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string[]} [opts.slugs] — subset/order; defaults to Drakeford → Robinson → Willingham (Ham optional)
 * @param {boolean} [opts.includeHam]
 * @param {boolean} [opts.clearPendingNonGolden]
 * @param {number} [opts.scheduleGapMs] — stagger scheduledAt between items
 * @param {boolean} [opts.forceRepublish] — bypass sent-ledger duplicate guard
 */
async function enqueueGoldenFourPosts(opts = {}) {
  const includeHam = opts.includeHam === true;
  let slugs = Array.isArray(opts.slugs) && opts.slugs.length ? opts.slugs.map(String) : DEFAULT_ORDER.slice(0, 3);
  if (includeHam && !slugs.includes('merrick-ham')) slugs.push('merrick-ham');

  slugs = slugs.filter((slug) => GOLDEN_FOUR_PROD_SLUGS.includes(slug));

  const doc = store.loadQueue();
  const cancelled = [];

  if (opts.clearPendingNonGolden === true) {
    for (const item of doc.items || []) {
      if (String(item.status || '').toLowerCase() !== 'pending') continue;
      const slug = String(item.playerSlug || '').toLowerCase();
      if (GOLDEN_FOUR_PROD_SLUGS.includes(slug)) continue;
      try {
        store.cancelPost(item.id);
        cancelled.push({ id: item.id, playerSlug: slug || null });
      } catch {
        /* already gone */
      }
    }
  }

  const results = [];
  const gapMs = Math.max(0, parseInt(opts.scheduleGapMs || '0', 10) || 0);
  let offsetMs = 0;

  for (const slug of slugs) {
    if (slugAlreadyPending(slug, store.listQueue({ status: 'pending' }))) {
      results.push({ slug, ok: false, reason: 'already_pending' });
      continue;
    }

    const intel = await pickFusedBeatIntel(slug);
    if (!intel) {
      results.push({ slug, ok: false, reason: 'no_beat_intel' });
      continue;
    }

    const intelFp = intel.fingerprint || intel.id || null;
    if (opts.forceRepublish !== true) {
      const archived = resolutionLedger.checkPlayerResolution(slug, { allowGoldenFour: true, intelFingerprint: intelFp });
      if (archived.blocked && archived.reason === 'player_archived') {
        results.push({ slug, ok: false, reason: 'player_archived', archiveReason: archived.archiveReason });
        continue;
      }
      const sentHit = slugRecentlySent(slug, intelFp);
      if (sentHit) {
        results.push({
          slug,
          ok: false,
          reason: 'duplicate_already_sent',
          tweetId: sentHit.tweetId || null
        });
        continue;
      }
    }

    const pre = await preflight.evaluatePlayerPostPreflight({
      playerSlug: slug,
      beatText: intel.detail || intel.skinny,
      intelFingerprint: intelFp,
      allowGoldenFour: true,
      allowRepublish: opts.forceRepublish === true
    });
    if (!pre.ok) {
      if (pre.action === 'archive') {
        resolutionLedger.markResolvedArchive(slug, pre.archiveReason || pre.reason, {
          source: 'golden-four-enqueue',
          committedTo: pre.committedTo || null,
          intelFingerprint: intelFp
        });
      }
      results.push({
        slug,
        ok: false,
        reason: pre.reason,
        archiveReason: pre.archiveReason || null
      });
      continue;
    }

    const on3Sync = await syncGoldenFourPlayerFromOn3(slug);
    if (!on3Sync.ok || on3Sync.rankingValid !== true) {
      results.push({
        slug,
        ok: false,
        reason: 'ranking_incomplete',
        on3Sync
      });
      continue;
    }

    await refreshGoldenFourRankingCache();

    const playerRow = await recruitingStore.getPlayerBySlug(slug);
    const elite = await composeGoldenFourPost(slug, intel, on3Sync, playerRow);
    if (!elite?.ok || !elite.text) {
      results.push({
        slug,
        ok: false,
        reason: elite?.reason || elite?.skipReason || 'compose_failed',
        factReason: elite?.factReason || null
      });
      continue;
    }

    const banned = validateBannedPhrases(elite.text);
    if (!banned.ok) {
      results.push({ slug, ok: false, reason: 'banned_phrases', violations: banned.violations });
      continue;
    }

    const candidate = {
      text: elite.text,
      category: 'news',
      action: 'post',
      topic: 'recruiting',
      urgencyLabel: 'major_beat',
      postUrgency: 'urgent',
      playerName: elite.playerName,
      playerSlug: elite.playerSlug || slug,
      source: 'golden-four-enqueue',
      sources: [{ name: 'GatorVault Beat Intel', url: 'https://gatorvaultinsider.com' }],
      validationMeta: {
        ...(elite.validationMeta || {}),
        eliteCompose: true,
        goldenFourEnqueue: true,
        beatText: intel.detail || intel.skinny
      },
      templateBlocks: elite.templateBlocks
    };

    const check = policy.validatePostContent(candidate);
    if (!check.valid) {
      results.push({ slug, ok: false, reason: 'validation', errors: check.errors });
      continue;
    }

    const scheduledAt = new Date(Date.now() + offsetMs).toISOString();
    offsetMs += gapMs;

    const tagged = cadence.tagCandidate({
      ...candidate,
      qualityScore: check.qualityScore ?? null,
      qualityBreakdown: check.qualityBreakdown ?? null,
      sourceConfidence: check.sourceConfidence ?? null
    });

    const out = store.enqueuePost({
      ...tagged,
      scheduledAt,
      status: cadence.resolveEnqueueStatus(tagged)
    });

    if (intel.id) {
      try {
        intelStore.markIntelXPostQueued(intel.id, { queueItemId: out.item.id });
      } catch {
        /* optional */
      }
    }

    results.push({
      slug,
      ok: true,
      itemId: out.item.id,
      scheduledAt,
      preview: String(elite.text).slice(0, 200),
      charCount: elite.text.length
    });
  }

  return {
    ok: results.some((r) => r.ok) || results.length === 0,
    partial: results.some((r) => r.ok) && results.some((r) => !r.ok),
    results,
    cancelled,
    pendingCount: store.listQueue({ status: 'pending' }).length
  };
}

module.exports = {
  DEFAULT_ORDER,
  pickBeatIntel,
  pickFusedBeatIntel,
  enqueueGoldenFourPosts
};
