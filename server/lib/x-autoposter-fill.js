/**
 * Auto-fill X autoposter queue from live GatorVault data (On3 events, articles, portal).
 * Runs when queue is low so the cron worker always has content to post.
 */
const crypto = require('crypto');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const recruitingStore = require('./recruiting-store');
const contentStore = require('./content-store');
const { commitFingerprint } = require('./commit-fingerprint');

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const ON3_PORTAL =
  process.env.ON3_PORTAL_SOURCE ||
  'https://www.on3.com/college/florida-gators/football/2026/commits/';
/** Only queue commit tweets for events created within this window (prevents replaying history). */
const MAX_COMMIT_EVENT_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_COMMIT_AGE_MS || String(6 * 60 * 60 * 1000),
  10
);

function dedupeKey(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

function alreadyQueued(text, items) {
  const key = dedupeKey(text);
  return items.some(
    (i) =>
      i.status === 'pending' ||
      (i.status === 'sent' && dedupeKey(i.text) === key && Date.now() - new Date(i.sentAt).getTime() < 7 * 86400000)
  );
}

function commitAlreadyQueued(fp, items) {
  if (!fp) return false;
  return items.some(
    (i) =>
      i.commitFingerprint === fp &&
      (i.status === 'pending' || i.status === 'sent' || i.status === 'failed')
  );
}

function buildNewsFromEvent(ev) {
  const title = String(ev.title || '').trim();
  if (!title) return null;
  const player = ev.payload?.player || { slug: ev.playerSlug };
  const fp = commitFingerprint(player);
  const skinny = String(ev.skinny || ev.detail || '').trim();
  const text = skinny ? `${title} — ${skinny}`.slice(0, 270) : `${title} 🐊`.slice(0, 270);
  return {
    text: text.includes(SITE_URL.replace('https://', '')) ? text : `${text} ${SITE_URL}`,
    category: ev.eventType?.startsWith('portal') ? 'news' : 'news',
    topic: ev.eventType?.startsWith('portal') ? 'portal' : 'recruiting',
    sources: [{ label: 'On3', url: ON3_PORTAL }],
    source: 'auto:on3-event',
    commitFingerprint: fp,
    sourceEventId: ev.id,
    sourceEventCreatedAt: ev.createdAt
  };
}

function buildNewsFromPortal(headliner) {
  if (!headliner?.name) return null;
  const text = `Portal headliner: ${headliner.name} (${headliner.htWt || headliner.pos}) — ${headliner.skinny || headliner.profileNote || 'UF incoming transfer'}`.slice(0, 240);
  return {
    text: `${text} ${SITE_URL}`,
    category: 'news',
    topic: 'portal',
    sources: [
      { label: 'On3', url: headliner.on3ProfileUrl || ON3_PORTAL }
    ],
    source: 'auto:portal-headliner'
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
  const text = `${article.title} — read in the Vault`.slice(0, 240);
  return {
    text: `${text} ${SITE_URL}`,
    category: 'news',
    topic: 'general',
    sources: [{ label: article.author || 'GatorVault', url: SITE_URL }],
    source: 'auto:article'
  };
}

async function refillAutoposterQueue({ minPending = 3, maxEnqueue = 5 } = {}) {
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  if (pending.length >= minPending) {
    return { ok: true, skipped: true, reason: 'queue_full', pending: pending.length, enqueued: [] };
  }

  const candidates = [];
  const slots = maxEnqueue - pending.length;

  try {
    const events = await recruitingStore.getEvents({ limit: 50 });
    const cutoff = Date.now() - MAX_COMMIT_EVENT_AGE_MS;
    events
      .filter((e) => e.source === 'on3' && ['commit', 'flip'].includes(e.eventType))
      .filter((e) => !String(e.title || '').includes('ranking'))
      .filter((e) => new Date(e.createdAt).getTime() >= cutoff)
      .slice(0, 5)
      .forEach((ev) => {
        const row = buildNewsFromEvent(ev);
        if (row) candidates.push(row);
      });
  } catch {
    /* optional */
  }

  try {
    const portal = await recruitingStore.getPortalBoard();
    const row = buildNewsFromPortal(portal.headliner);
    if (row) candidates.unshift(row);
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

  const promo = buildPromoFromMix();
  if (promo) candidates.push(promo);

  const enqueued = [];
  let added = 0;
  for (const raw of candidates) {
    if (added >= slots) break;
    if (raw.commitFingerprint && commitAlreadyQueued(raw.commitFingerprint, doc.items)) continue;
    if (alreadyQueued(raw.text, doc.items)) continue;
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
      added += 1;
    } catch {
      /* skip invalid */
    }
  }

  return { ok: true, skipped: false, pending: pending.length, enqueued, enqueuedCount: enqueued.length };
}

module.exports = {
  refillAutoposterQueue,
  dedupeKey
};
