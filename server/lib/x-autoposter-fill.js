/**
 * Auto-fill X autoposter queue from live GatorVault data (On3 events, intel, beat writers, articles, portal).
 * Evaluates beat-writer posts, recruiting momentum, commits, visits, portal, and general UF intel.
 */
const crypto = require('crypto');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const recruitingStore = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const contentStore = require('./content-store');
const { commitFingerprint, intelFingerprint } = require('./commit-fingerprint');
const { getBeatPosts } = require('./live-beat');
const beatFilters = require('./beat-writer-filters');
const copy = require('./x-autoposter-copy');
const cadence = require('./x-autoposter-cadence');
const validation = require('./x-autoposter-validation');

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const ON3_PORTAL =
  process.env.ON3_PORTAL_SOURCE ||
  'https://www.on3.com/college/florida-gators/football/2026/commits/';
/** Only queue events within freshness window (3h normal; validation also enforces 30m breaking). */
const MAX_COMMIT_EVENT_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_COMMIT_AGE_MS || String(validation.MAX_NEWS_AGE_MS),
  10
);
const MAX_BEAT_POST_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_BEAT_AGE_MS || String(validation.MAX_NEWS_AGE_MS),
  10
);
const MAX_INTEL_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_INTEL_AGE_MS || String(validation.MAX_NEWS_AGE_MS),
  10
);

function attachNewsMeta(row, built) {
  if (!row || !built) return row;
  return {
    ...row,
    templateBlocks: built.templateBlocks || row.templateBlocks,
    validationMeta: built.validationMeta || row.validationMeta,
    playerContext: built.playerContext || row.playerContext
  };
}

function dedupeKey(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

const QUEUED_STATUSES = new Set(['pending', 'sent', 'skipped_duplicate']);

function fingerprintAlreadyQueued(fp, items) {
  if (!fp) return false;
  return items.some(
    (i) =>
      (i.intelFingerprint === fp || i.commitFingerprint === fp) && QUEUED_STATUSES.has(i.status)
  );
}

function alreadyQueued(text, items) {
  const key = dedupeKey(text);
  const weekAgo = Date.now() - 7 * 86400000;
  return items.some((i) => {
    if (dedupeKey(i.text) !== key) return false;
    if (i.status === 'pending' || i.status === 'skipped_duplicate') return true;
    if (i.status === 'sent' && i.sentAt && new Date(i.sentAt).getTime() >= weekAgo) return true;
    if (i.status === 'failed' && /duplicate content/i.test(i.error || '')) return true;
    return false;
  });
}

function commitAlreadyQueued(fp, items) {
  return fingerprintAlreadyQueued(fp, items);
}

async function buildNewsFromEvent(ev) {
  const built = await copy.buildRecruitingEventCopyAsync(ev, { source: 'On3' });
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const player = ev.payload?.player || { slug: ev.playerSlug };
  const fp = commitFingerprint(player);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: ev.eventType?.startsWith('portal') ? 'portal' : 'recruiting',
      urgencyLabel: ev.eventType?.startsWith('portal') ? 'portal' : 'commitment',
      sourceEventType: ev.eventType,
      sources: [{ label: 'On3', url: ON3_PORTAL }],
      source: 'auto:on3-event',
      commitFingerprint: fp,
      intelFingerprint: fp,
      sourceEventId: ev.id,
      sourceEventCreatedAt: ev.createdAt,
      playerName: built.playerName || player.name || null
    },
    built
  );
}

async function buildNewsFromIntel(intel) {
  const built = await copy.buildIntelCopyAsync(intel);
  if (built?.skipReason) return { skipReason: built.skipReason, _identitySkip: true };
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const fp = intel.fingerprint || intelFingerprint(intel.playerId, intel.eventType, intel.timestamp);
  const intelType = String(intel.eventType || '').toLowerCase();
  const urgentIntel = /visit_cancel|visit_scheduled|rivals_prediction|injury/.test(intelType);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'recruiting',
      urgencyLabel: /injury/.test(intelType) ? 'injury' : urgentIntel ? 'major_beat' : null,
      sourceEventType: intel.eventType,
      sources: [{ label: intel.source || 'Insider', url: intel.sourceHandle ? `https://x.com/${intel.sourceHandle}` : SITE_URL }],
      source: 'auto:intel',
      intelFingerprint: fp,
      intelType: intel.eventType,
      playerName: built.playerName || intel.playerName,
      sourceIntelId: intel.id,
      sourceEventCreatedAt: intel.timestamp || intel.createdAt || null,
      eventTimestamp: intel.timestamp || intel.createdAt || null
    },
    built
  );
}

async function buildNewsFromPortal(headliner) {
  const built = await copy.buildPortalHeadlinerCopyAsync(headliner);
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const fp = intelFingerprint(headliner.on3Id || headliner.slug || headliner.name, 'portal_headliner', headliner.updatedAt || 'once');
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'portal',
      urgencyLabel: 'portal',
      sourceEventType: 'portal_headliner',
      sources: [{ label: 'On3', url: headliner.on3ProfileUrl || ON3_PORTAL }],
      source: 'auto:portal-headliner',
      intelFingerprint: fp,
      playerName: built.playerName,
      sourceEventCreatedAt: headliner.updatedAt || null
    },
    built
  );
}

function prepareNewsCandidate(raw) {
  if (!raw?.text || copy.isBrokenCopy(raw.text, raw)) return null;
  const gate = validation.passesNewsQualityGate(raw);
  if (!gate.pass) return null;
  return {
    ...raw,
    qualityScore: gate.scored?.score ?? null,
    qualityBreakdown: gate.scored?.breakdown ?? null,
    sourceConfidence: gate.scored?.sourceConfidence ?? null
  };
}

async function finalizeNewsCandidate(rawCandidate) {
  let raw = rawCandidate;
  if (raw._articleBuild) {
    const articleBuilt = await copy.buildArticleCopyAsync(raw._articleBuild);
    if (!articleBuilt?.text) return null;
    raw = attachNewsMeta(
      {
        ...raw,
        text: articleBuilt.text,
        playerName: articleBuilt.playerName,
        sourceEventCreatedAt: raw._articleBuild.publishedAt || raw._articleBuild.date || null
      },
      articleBuilt
    );
    delete raw._articleBuild;
  }
  return prepareNewsCandidate(raw);
}

function buildPromoFromMix() {
  const mix = store.getMixStats();
  const cat = mix.suggestedNextCategory || 'promo';
  if (cat === 'engagement') {
    return {
      text: `What's the biggest question about the Gators right now — QB, portal, or the 3-3-5? Drop it below 🐊 ${SITE_URL}`,
      category: 'engagement',
      topic: 'general',
      sources: [{ label: 'GatorVault', url: SITE_URL }],
      source: 'auto:engagement'
    };
  }
  if (cat === 'promo') {
    return {
      text: `Film Room + Portal Radar + live recruiting intel — free 30-day trial at GatorVault 🐊 ${SITE_URL}`,
      category: 'promo',
      topic: 'general',
      sources: [{ label: 'GatorVault', url: SITE_URL }],
      source: 'auto:promo'
    };
  }
  return null;
}

function buildNewsFromArticle(article) {
  if (!article?.title) return null;
  const playerName = copy.extractPlayerFromText(`${article.title} ${article.summary || ''}`);
  if (!playerName) return null;
  const fp = intelFingerprint(article.id || article.title, 'article', article.publishedAt || article.date);
  return {
    text: null,
    category: 'news',
    topic: 'general',
    urgencyLabel: 'analysis',
    sourceEventType: 'article',
    sources: [{ label: article.author || 'GatorVault', url: SITE_URL }],
    source: 'auto:article',
    intelFingerprint: fp,
    playerName,
    _articleBuild: article
  };
}

async function buildMomentumFromBeat(post) {
  const built = await copy.buildMomentumCopyAsync(post);
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const player = built.playerName || copy.extractPlayerFromText(String(post.text || ''));
  const source = post.writerName || post.outlet || post.handle || 'Insider';
  const fp = intelFingerprint(post.id || post.url, 'recruiting_momentum', post.publishedAt);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'recruiting',
      urgencyLabel: 'major_beat',
      sourceEventType: 'recruiting_momentum',
      sources: [{ label: source, url: post.url || SITE_URL }],
      source: 'auto:beat-momentum',
      intelType: 'recruiting_momentum',
      intelFingerprint: fp,
      playerName: player,
      sourceEventCreatedAt: post.publishedAt,
      sourcePublishedAt: post.publishedAt
    },
    built
  );
}

async function buildNewsFromBeatPost(post) {
  if (!beatFilters.shouldIncludeBeatPost(post) || !beatFilters.isTrustedBeatWriter(post)) return null;
  const built = await copy.buildBeatIntelCopyAsync(post);
  if (built?.skipReason) return { skipReason: built.skipReason, _identitySkip: true };
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const source = post.writerName || post.outlet || post.handle || 'Beat writer';
  const fp = intelFingerprint(post.id || post.url, 'beat_intel', post.publishedAt);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'recruiting',
      urgencyLabel: 'major_beat',
      sourceEventType: 'beat_intel',
      sources: [{ label: source, url: post.url || SITE_URL }],
      source: 'auto:beat-intel',
      intelFingerprint: fp,
      playerName: built.playerName || copy.extractPlayerFromText(String(post.text || '')),
      sourceEventCreatedAt: post.publishedAt,
      sourcePublishedAt: post.publishedAt
    },
    built
  );
}

async function buildNewsFromPortalEvent(ev) {
  const built = await copy.buildRecruitingEventCopyAsync(ev, { source: 'On3' });
  if (!built?.text || copy.isBrokenCopy(built.text, built)) return null;
  const fp = intelFingerprint(ev.playerSlug || ev.id, ev.eventType, ev.createdAt);
  return attachNewsMeta(
    {
      text: built.text,
      category: 'news',
      topic: 'portal',
      urgencyLabel: 'portal',
      sourceEventType: ev.eventType,
      sources: [{ label: 'On3', url: ON3_PORTAL }],
      source: 'auto:on3-portal',
      intelFingerprint: fp,
      sourceEventId: ev.id,
      sourceEventCreatedAt: ev.createdAt,
      playerName: built.playerName
    },
    built
  );
}

async function collectFreshPostCandidates() {
  const candidates = [];

  try {
    const unqueuedIntel = intelStore.getUnqueuedIntel({ maxAgeMs: MAX_INTEL_AGE_MS });
    for (const intel of unqueuedIntel.slice(0, 8)) {
      const eligibility = require('./rivals-prediction-eligibility');
      const gate = await eligibility.checkIntelForAutopost(intel);
      if (!gate.allowed) continue;
      const row = await buildNewsFromIntel(intel);
      if (row) candidates.unshift(row);
    }
  } catch {
    /* optional */
  }

  try {
    const beat = getBeatPosts(50);
    const beatCutoff = Date.now() - MAX_BEAT_POST_AGE_MS;
    for (const post of beat.posts || []) {
      if (new Date(post.publishedAt).getTime() < beatCutoff) continue;
      const momentum = await buildMomentumFromBeat(post);
      if (momentum) {
        candidates.unshift(momentum);
        continue;
      }
      const beatNews = await buildNewsFromBeatPost(post);
      if (beatNews) candidates.unshift(beatNews);
    }
  } catch {
    /* optional */
  }

  try {
    const events = await recruitingStore.getEvents({ limit: 50 });
    const cutoff = Date.now() - MAX_COMMIT_EVENT_AGE_MS;
    for (const ev of events
      .filter((e) => e.source === 'on3' && ['commit', 'flip'].includes(e.eventType))
      .filter((e) => !String(e.title || '').includes('ranking'))
      .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
      .slice(0, 5)) {
      const row = await buildNewsFromEvent(ev);
      if (row) candidates.push(row);
    }
    for (const ev of events
      .filter((e) => e.source === 'on3' && ['portal_in', 'portal_out'].includes(e.eventType))
      .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
      .slice(0, 3)) {
      const row = await buildNewsFromPortalEvent(ev);
      if (row) candidates.push(row);
    }
  } catch {
    /* optional */
  }

  try {
    const portal = await recruitingStore.getPortalBoard();
    const row = await buildNewsFromPortal(portal.headliner);
    if (row) candidates.push(row);
  } catch {
    /* optional */
  }

  try {
    const articles = contentStore.loadPublishedArticles();
    if (articles[0]) {
      const row = buildNewsFromArticle(articles[0]);
      if (row) candidates.push(row);
    }
  } catch {
    /* optional */
  }

  return candidates;
}

async function refillAutoposterQueue({ minPending = 3, maxEnqueue = 5 } = {}) {
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  const need = Math.max(minPending - pending.length, pending.length === 0 ? 1 : 0);
  if (need <= 0 && pending.length >= minPending) {
    return { ok: true, skipped: true, reason: 'queue_full', pending: pending.length, enqueued: [] };
  }

  const slots = Math.max(maxEnqueue - pending.length, need);
  const rawNewsCandidates = await collectFreshPostCandidates();
  const validatedNews = [];
  for (const raw of rawNewsCandidates) {
    if (raw?.skipReason || raw?._identitySkip) continue;
    const scored = await finalizeNewsCandidate(raw);
    if (scored) validatedNews.push(scored);
  }

  /** Content-mix (50/30/20) runs only after news quality scoring. */
  const allowPromo = process.env.X_AUTOPOST_ALLOW_PROMO === 'true';
  const finalCandidates = [...validatedNews];
  if (allowPromo) {
    const promo = buildPromoFromMix();
    if (promo) finalCandidates.push(promo);
  }

  const enqueued = [];
  let added = 0;
  let qualitySkipped = rawNewsCandidates.length - validatedNews.length;
  for (const raw of finalCandidates) {
    if (added >= slots) break;
    const fp = raw.intelFingerprint || raw.commitFingerprint;
    if (fp && fingerprintAlreadyQueued(fp, doc.items)) continue;
    if (raw.commitFingerprint && commitAlreadyQueued(raw.commitFingerprint, doc.items)) continue;
    if (alreadyQueued(raw.text, doc.items)) continue;
    const check = policy.validatePostContent(raw);
    if (!check.valid) continue;
    try {
      const tagged = cadence.tagCandidate({
        ...raw,
        qualityScore: raw.qualityScore ?? check.qualityScore ?? null,
        qualityBreakdown: raw.qualityBreakdown ?? check.qualityBreakdown ?? null,
        sourceConfidence: raw.sourceConfidence ?? check.sourceConfidence ?? null
      });
      const out = store.enqueuePost({
        ...tagged,
        scheduledAt: store.nowIso(),
        status: 'pending'
      });
      enqueued.push(out.item);
      doc.items.push(out.item);
      if (raw.sourceIntelId) {
        intelStore.markIntelXPostQueued(raw.sourceIntelId);
      }
      added += 1;
    } catch {
      /* skip invalid */
    }
  }

  return {
    ok: true,
    skipped: false,
    pending: pending.length,
    enqueued,
    enqueuedCount: enqueued.length,
    qualitySkipped,
    validatedNewsCount: validatedNews.length
  };
}

module.exports = {
  refillAutoposterQueue,
  collectFreshPostCandidates,
  finalizeNewsCandidate,
  alreadyQueued,
  dedupeKey,
  fingerprintAlreadyQueued,
  buildNewsFromIntel,
  buildNewsFromBeatPost,
  buildMomentumFromBeat
};
