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

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const ON3_PORTAL =
  process.env.ON3_PORTAL_SOURCE ||
  'https://www.on3.com/college/florida-gators/football/2026/commits/';
/** Only queue commit tweets for events created within this window (prevents replaying history). */
const MAX_COMMIT_EVENT_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_COMMIT_AGE_MS || String(6 * 60 * 60 * 1000),
  10
);
const MAX_BEAT_POST_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_BEAT_AGE_MS || String(6 * 60 * 60 * 1000),
  10
);
const MAX_INTEL_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_INTEL_AGE_MS || String(7 * 86400000),
  10
);

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
  if (!built?.text || copy.isBrokenCopy(built.text)) return null;
  const player = ev.payload?.player || { slug: ev.playerSlug };
  const fp = commitFingerprint(player);
  return {
    text: built.text,
    category: 'news',
    topic: ev.eventType?.startsWith('portal') ? 'portal' : 'recruiting',
    sources: [{ label: 'On3', url: ON3_PORTAL }],
    source: 'auto:on3-event',
    commitFingerprint: fp,
    intelFingerprint: fp,
    sourceEventId: ev.id,
    sourceEventCreatedAt: ev.createdAt,
    playerName: built.playerName || player.name || null
  };
}

async function buildNewsFromIntel(intel) {
  const built = await copy.buildIntelCopyAsync(intel);
  if (!built?.text || copy.isBrokenCopy(built.text)) return null;
  const fp = intel.fingerprint || intelFingerprint(intel.playerId, intel.eventType, intel.timestamp);
  return {
    text: built.text,
    category: 'news',
    topic: 'recruiting',
    sources: [{ label: intel.source || 'Insider', url: intel.sourceHandle ? `https://x.com/${intel.sourceHandle}` : SITE_URL }],
    source: 'auto:intel',
    intelFingerprint: fp,
    intelType: intel.eventType,
    playerName: built.playerName || intel.playerName,
    sourceIntelId: intel.id
  };
}

async function buildNewsFromPortal(headliner) {
  const built = await copy.buildPortalHeadlinerCopyAsync(headliner);
  if (!built?.text || copy.isBrokenCopy(built.text)) return null;
  const fp = intelFingerprint(headliner.on3Id || headliner.slug || headliner.name, 'portal_headliner', headliner.updatedAt || 'once');
  return {
    text: built.text,
    category: 'news',
    topic: 'portal',
    sources: [{ label: 'On3', url: headliner.on3ProfileUrl || ON3_PORTAL }],
    source: 'auto:portal-headliner',
    intelFingerprint: fp,
    playerName: built.playerName
  };
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
  const fp = intelFingerprint(article.id || article.title, 'article', article.publishedAt || article.date);
  const text = `${article.title} — read in the Vault`.slice(0, 240);
  return {
    text: `${text} ${SITE_URL}`,
    category: 'news',
    topic: 'general',
    sources: [{ label: article.author || 'GatorVault', url: SITE_URL }],
    source: 'auto:article',
    intelFingerprint: fp
  };
}

async function buildMomentumFromBeat(post) {
  const text = await copy.buildMomentumCopyAsync(post);
  if (!text || copy.isBrokenCopy(text)) return null;
  const player = copy.extractPlayerFromText(String(post.text || ''));
  const source = post.writerName || post.outlet || post.handle || 'Insider';
  const fp = intelFingerprint(post.id || post.url, 'recruiting_momentum', post.publishedAt);
  return {
    text,
    category: 'news',
    topic: 'recruiting',
    sources: [{ label: source, url: post.url || SITE_URL }],
    source: 'auto:beat-momentum',
    intelType: 'recruiting_momentum',
    intelFingerprint: fp,
    playerName: player
  };
}

async function buildNewsFromBeatPost(post) {
  if (!beatFilters.shouldIncludeBeatPost(post) || !beatFilters.isTrustedBeatWriter(post)) return null;
  const text = await copy.buildBeatIntelCopyAsync(post);
  if (!text || copy.isBrokenCopy(text)) return null;
  const source = post.writerName || post.outlet || post.handle || 'Beat writer';
  const fp = intelFingerprint(post.id || post.url, 'beat_intel', post.publishedAt);
  return {
    text,
    category: 'news',
    topic: 'recruiting',
    sources: [{ label: source, url: post.url || SITE_URL }],
    source: 'auto:beat-intel',
    intelFingerprint: fp,
    playerName: copy.extractPlayerFromText(String(post.text || ''))
  };
}

async function buildNewsFromPortalEvent(ev) {
  const built = await copy.buildRecruitingEventCopyAsync(ev, { source: 'On3' });
  if (!built?.text || copy.isBrokenCopy(built.text)) return null;
  const fp = intelFingerprint(ev.playerSlug || ev.id, ev.eventType, ev.createdAt);
  return {
    text: built.text,
    category: 'news',
    topic: 'portal',
    sources: [{ label: 'On3', url: ON3_PORTAL }],
    source: 'auto:on3-portal',
    intelFingerprint: fp,
    sourceEventId: ev.id,
    playerName: built.playerName
  };
}

async function refillAutoposterQueue({ minPending = 3, maxEnqueue = 5 } = {}) {
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  const need = Math.max(minPending - pending.length, pending.length === 0 ? 1 : 0);
  if (need <= 0 && pending.length >= minPending) {
    return { ok: true, skipped: true, reason: 'queue_full', pending: pending.length, enqueued: [] };
  }

  const candidates = [];
  const slots = Math.max(maxEnqueue - pending.length, need);

  try {
    const unqueuedIntel = intelStore.getUnqueuedIntel({ maxAgeMs: MAX_INTEL_AGE_MS });
    for (const intel of unqueuedIntel.slice(0, 5)) {
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
      if (beatNews) candidates.push(beatNews);
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
    if (row && !fingerprintAlreadyQueued(row.intelFingerprint, doc.items)) {
      candidates.push(row);
    }
  } catch {
    /* optional */
  }

  try {
    const articles = contentStore.loadPublishedArticles();
    if (articles[0]) {
      const row = buildNewsFromArticle(articles[0]);
      if (row && !fingerprintAlreadyQueued(row.intelFingerprint, doc.items)) {
        candidates.push(row);
      }
    }
  } catch {
    /* optional */
  }

  const promo = buildPromoFromMix();
  if (promo) candidates.push(promo);

  const enqueued = [];
  let added = 0;
  for (const raw of candidates) {
    if (added >= slots) break;
    const fp = raw.intelFingerprint || raw.commitFingerprint;
    if (fp && fingerprintAlreadyQueued(fp, doc.items)) continue;
    if (raw.commitFingerprint && commitAlreadyQueued(raw.commitFingerprint, doc.items)) continue;
    if (alreadyQueued(raw.text, doc.items)) continue;
    if (copy.isBrokenCopy(raw.text)) continue;
    const check = policy.validatePostContent(raw);
    if (!check.valid) continue;
    try {
      const out = store.enqueuePost({
        ...raw,
        scheduledAt: new Date(Date.now() + added * 45 * 60 * 1000).toISOString(),
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

  return { ok: true, skipped: false, pending: pending.length, enqueued, enqueuedCount: enqueued.length };
}

module.exports = {
  refillAutoposterQueue,
  dedupeKey,
  fingerprintAlreadyQueued,
  buildNewsFromIntel,
  buildNewsFromBeatPost,
  buildMomentumFromBeat
};
