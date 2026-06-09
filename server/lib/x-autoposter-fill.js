/**
 * Auto-fill X autoposter queue from live GatorVault data (On3 events, intel, articles, portal).
 * Only NEW commits, visits, predictions, and trending intel are queued (dedupe by fingerprint).
 */
const crypto = require('crypto');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const recruitingStore = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const contentStore = require('./content-store');
const { commitFingerprint, intelFingerprint } = require('./commit-fingerprint');

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const ON3_PORTAL =
  process.env.ON3_PORTAL_SOURCE ||
  'https://www.on3.com/college/florida-gators/football/2026/commits/';
/** Only queue commit tweets for events created within this window (prevents replaying history). */
const MAX_COMMIT_EVENT_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_COMMIT_AGE_MS || String(6 * 60 * 60 * 1000),
  10
);
const MAX_INTEL_AGE_MS = parseInt(
  process.env.X_AUTOPOST_MAX_INTEL_AGE_MS || String(7 * 86400000),
  10
);

function dedupeKey(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

function fingerprintAlreadyQueued(fp, items) {
  if (!fp) return false;
  return items.some(
    (i) =>
      (i.intelFingerprint === fp || i.commitFingerprint === fp) &&
      (i.status === 'pending' || i.status === 'sent' || i.status === 'failed')
  );
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
  return fingerprintAlreadyQueued(fp, items);
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
    category: 'news',
    topic: ev.eventType?.startsWith('portal') ? 'portal' : 'recruiting',
    sources: [{ label: 'On3', url: ON3_PORTAL }],
    source: 'auto:on3-event',
    commitFingerprint: fp,
    intelFingerprint: fp,
    sourceEventId: ev.id,
    sourceEventCreatedAt: ev.createdAt,
    playerName: player.name || null
  };
}

function buildNewsFromIntel(intel) {
  const name = intel.playerName || 'Recruit';
  const visitRange =
    intel.visitStart && intel.visitEnd ? `${intel.visitStart}–${intel.visitEnd}` : intel.visitStart || '';
  let text;
  if (intel.eventType === 'official_visit') {
    text = `${name} (${intel.pos || 'Recruit'}) — Official visit to Gainesville${visitRange ? ` · ${visitRange}` : ''}. Source: ${intel.source} 🐊`;
  } else if (intel.eventType === 'prediction') {
    text = `${name} — ${intel.detail || 'New prediction intel'} · ${intel.source} 🐊`;
  } else {
    text = `${name} — ${intel.detail || intel.status || 'New recruiting intel'} · ${intel.source} 🐊`;
  }
  const fp = intel.fingerprint || intelFingerprint(intel.playerId, intel.eventType, intel.timestamp);
  return {
    text: `${text.slice(0, 240)} ${SITE_URL}`,
    category: 'news',
    topic: 'recruiting',
    sources: [{ label: intel.source || 'Insider', url: intel.sourceHandle ? `https://x.com/${intel.sourceHandle}` : SITE_URL }],
    source: 'auto:intel',
    intelFingerprint: fp,
    intelType: intel.eventType,
    playerName: intel.playerName,
    sourceIntelId: intel.id
  };
}

function buildNewsFromPortal(headliner) {
  if (!headliner?.name) return null;
  const fp = intelFingerprint(headliner.on3Id || headliner.slug || headliner.name, 'portal_headliner', headliner.updatedAt || 'once');
  const text = `Portal headliner: ${headliner.name} (${headliner.htWt || headliner.pos}) — ${headliner.skinny || headliner.profileNote || 'UF incoming transfer'}`.slice(0, 240);
  return {
    text: `${text} ${SITE_URL}`,
    category: 'news',
    topic: 'portal',
    sources: [{ label: 'On3', url: headliner.on3ProfileUrl || ON3_PORTAL }],
    source: 'auto:portal-headliner',
    intelFingerprint: fp
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

async function refillAutoposterQueue({ minPending = 3, maxEnqueue = 5 } = {}) {
  const doc = store.loadQueue();
  const pending = doc.items.filter((i) => i.status === 'pending');
  if (pending.length >= minPending) {
    return { ok: true, skipped: true, reason: 'queue_full', pending: pending.length, enqueued: [] };
  }

  const candidates = [];
  const slots = maxEnqueue - pending.length;
  const intelCutoff = Date.now() - MAX_INTEL_AGE_MS;

  try {
    const unqueuedIntel = intelStore.getUnqueuedIntel({ maxAgeMs: MAX_INTEL_AGE_MS });
    unqueuedIntel.slice(0, 3).forEach((intel) => {
      const row = buildNewsFromIntel(intel);
      if (row) candidates.unshift(row);
    });
  } catch {
    /* optional */
  }

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
  fingerprintAlreadyQueued
};
