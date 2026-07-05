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
    rows.find((row) => /beat|detectives|visit|target|unofficial/i.test(String(row.source || ''))) ||
    rows[0];
  return beatFirst || null;
}

function slugAlreadyPending(slug, items = []) {
  return items.some(
    (item) =>
      String(item.status || '').toLowerCase() === 'pending' &&
      String(item.playerSlug || '').toLowerCase() === slug
  );
}

async function composeGoldenFourPost(slug, intel) {
  return eliteCaption.buildElitePlayerPost({
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
}

/**
 * @param {object} opts
 * @param {string[]} [opts.slugs] — subset/order; defaults to Drakeford → Robinson → Willingham (Ham optional)
 * @param {boolean} [opts.includeHam]
 * @param {boolean} [opts.clearPendingNonGolden]
 * @param {number} [opts.scheduleGapMs] — stagger scheduledAt between items
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

    const intel = pickBeatIntel(slug);
    if (!intel) {
      results.push({ slug, ok: false, reason: 'no_beat_intel' });
      continue;
    }

    const elite = await composeGoldenFourPost(slug, intel);
    if (!elite?.ok || !elite.text) {
      results.push({ slug, ok: false, reason: elite?.reason || elite?.skipReason || 'compose_failed' });
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
      status: 'pending'
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
    ok: results.some((r) => r.ok),
    results,
    cancelled,
    pendingCount: store.listQueue({ status: 'pending' }).length
  };
}

module.exports = {
  DEFAULT_ORDER,
  pickBeatIntel,
  enqueueGoldenFourPosts
};
