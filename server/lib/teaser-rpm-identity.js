/**
 * Pass 2 — resolve nameless On3 RPM / prediction teasers to a real prospect.
 * Uses public article pageProps: tags (on3 recruit slug), featuredImage alt/caption.
 */
'use strict';

const ORG_TWITTER_NOISE = new Set([
  'gatorsfb',
  'gatorsonline',
  'on3sports',
  'on3recruits',
  'rivals',
  'ufgators',
  'secnetwork',
  'espn',
]);

const TAG_YEAR_RE = /^(.+?)\s*\((\d{2})\s*[-–]\s*([^)]+)\)\s*$/;
const ALT_CLASS_POS_NAME_RE =
  /\b(202[6-9]|203[0-2])\s+(WR|QB|RB|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P|IOL)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})\b/;
const HANDLE_RE = /@([A-Za-z0-9_]{2,30})/g;
const ON3_RECRUIT_TAG_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)+-\d+$/;

function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function playerSlugFromOn3Slug(on3Slug) {
  return String(on3Slug || '')
    .toLowerCase()
    .replace(/-\d+$/, '');
}

function extractHandles(text) {
  const out = [];
  const s = String(text || '');
  let m;
  HANDLE_RE.lastIndex = 0;
  while ((m = HANDLE_RE.exec(s))) {
    const h = m[1].toLowerCase();
    if (!ORG_TWITTER_NOISE.has(h)) out.push(h);
  }
  return [...new Set(out)];
}

function parseTagIdentity(tag) {
  const slug = String(tag?.slug || '').toLowerCase();
  const nameRaw = String(tag?.name || '').trim();
  if (!ON3_RECRUIT_TAG_SLUG_RE.test(slug)) return null;
  // Skip obvious coaches / staff tags (no class-year paren and known coach patterns)
  const yearMatch = nameRaw.match(TAG_YEAR_RE);
  const playerSlug = playerSlugFromOn3Slug(slug);
  if (!playerSlug || playerSlug.split('-').length < 2) return null;
  if (yearMatch) {
    const yy = parseInt(yearMatch[2], 10);
    const classYear = yy >= 26 && yy <= 40 ? 2000 + yy : null;
    return {
      playerSlug,
      playerName: yearMatch[1].trim(),
      classYear,
      schoolHint: yearMatch[3].trim(),
      on3Slug: slug,
      source: 'on3_article_tag',
      confidence: 'high',
    };
  }
  // Recruit-id style slug without year paren — medium unless name looks like a person
  if (/coach|staff|sumrall|napier|coordinator|collins|analyst|reporter/i.test(nameRaw)) return null;
  return {
    playerSlug,
    playerName: nameRaw || slugifyName(playerSlug).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    classYear: null,
    schoolHint: null,
    on3Slug: slug,
    source: 'on3_article_tag',
    confidence: 'medium',
  };
}

function parseFeaturedImageIdentity(featuredImage) {
  const title = String(featuredImage?.title || '');
  const alt = String(featuredImage?.altText || '');
  const caption = String(featuredImage?.caption || '');
  const blob = `${title} ${alt}`;
  const m = blob.match(ALT_CLASS_POS_NAME_RE);
  const handles = extractHandles(caption);
  if (!m && !handles.length) return null;
  const out = {
    playerSlug: m ? slugifyName(m[3]) : null,
    playerName: m ? m[3].trim() : null,
    classYear: m ? parseInt(m[1], 10) : null,
    pos: m ? m[2].toUpperCase() : null,
    twitterHandles: handles,
    source: 'on3_featured_image',
    confidence: m ? 'high' : 'low',
  };
  return out;
}

function pickBestCandidate(candidates) {
  const rank = { high: 3, medium: 2, low: 1 };
  return [...candidates]
    .filter((c) => c && c.playerSlug)
    .sort((a, b) => (rank[b.confidence] || 0) - (rank[a.confidence] || 0))[0] || null;
}

function extractCandidatesFromArticle(article) {
  const candidates = [];
  for (const tag of article?.tags || []) {
    const parsed = parseTagIdentity(tag);
    if (parsed) candidates.push(parsed);
  }
  const fromImage = parseFeaturedImageIdentity(article?.featuredImage);
  if (fromImage?.playerSlug) candidates.push(fromImage);
  return candidates;
}

function mergeHints(best, imageHints) {
  if (!best) return null;
  return {
    playerSlug: best.playerSlug,
    playerName: best.playerName,
    classYear: best.classYear || imageHints?.classYear || null,
    pos: best.pos || imageHints?.pos || null,
    schoolHint: best.schoolHint || null,
    on3Slug: best.on3Slug || null,
    twitterHandles: imageHints?.twitterHandles || best.twitterHandles || [],
    source: best.source,
    confidence: best.confidence,
  };
}

/**
 * Pure parse from already-fetched pageProps (tests / offline).
 */
function resolveIdentityFromPageProps(pageProps) {
  const article = pageProps?.article || pageProps?.post || null;
  if (!article) return { ok: false, reason: 'no_article' };
  const candidates = extractCandidatesFromArticle(article);
  const imageHints = parseFeaturedImageIdentity(article.featuredImage);
  const best = pickBestCandidate(candidates);
  if (!best) {
    return {
      ok: false,
      reason: 'no_candidate',
      twitterHandles: imageHints?.twitterHandles || [],
      title: article.title || null,
    };
  }
  return {
    ok: true,
    ...mergeHints(best, imageHints),
    title: article.title || null,
    articleKey: article.key || null,
    candidates: candidates.slice(0, 5),
  };
}

async function resolveIdentityFromOn3ArticleUrl(url, { classYear = 2028, fetchPageProps = null } = {}) {
  const clean = String(url || '').trim();
  if (!/on3\.com\/.*\/news\//i.test(clean)) {
    return { ok: false, reason: 'not_on3_news_url' };
  }
  const fetchFn =
    fetchPageProps ||
    (async (u, year) => {
      const on3 = require('./on3-recruit-client');
      return on3.fetchNextPageProps(u, year);
    });
  try {
    const pageProps = await fetchFn(clean, classYear);
    return resolveIdentityFromPageProps(pageProps);
  } catch (err) {
    return { ok: false, reason: 'fetch_failed', error: err.message };
  }
}

/**
 * Enrich an unresolved queue item; optionally auto-resolve high-confidence hits.
 */
async function enrichUnresolvedPredictionItem(item, options = {}) {
  const autoResolve = options.autoResolve !== false;
  const minConfidence = options.minConfidence || 'high';
  if (!item?.url) return { enriched: false, reason: 'no_url' };

  const identity = await resolveIdentityFromOn3ArticleUrl(item.url, {
    classYear: item.classYearHint || 2028,
    fetchPageProps: options.fetchPageProps,
  });
  if (!identity.ok) return { enriched: false, identity };

  const store = require('./unresolved-predictions-store');
  const patch = {
    playerNameHint: identity.playerName || item.playerNameHint,
    playerSlugHint: identity.playerSlug || item.playerSlugHint,
    classYearHint: identity.classYear || item.classYearHint,
    posHint: identity.pos || item.posHint,
    suggestedSlug: identity.playerSlug,
    suggestedName: identity.playerName,
    suggestedConfidence: identity.confidence,
    identitySource: identity.source,
    twitterHandles: identity.twitterHandles || [],
  };
  const updated = store.patchItem(item.id, patch);
  if (!updated) return { enriched: false, reason: 'not_found' };

  const confRank = { high: 3, medium: 2, low: 1 };
  const strongEnough = (confRank[identity.confidence] || 0) >= (confRank[minConfidence] || 3);
  if (autoResolve && strongEnough && identity.playerSlug) {
    const resolved = store.resolveItem(item.id, {
      playerSlug: identity.playerSlug,
      note: `auto:${identity.source}:${identity.confidence}`,
    });
    let allowlist = null;
    try {
      const { addToAdminAllowlist } = require('./admin-allowlist-store');
      allowlist = addToAdminAllowlist({
        slug: identity.playerSlug,
        name: identity.playerName || identity.playerSlug,
        classYear: identity.classYear || 2028,
      });
    } catch (err) {
      allowlist = { added: false, error: err.message };
    }
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'recruiting:teaser-identity',
        status: 'auto_resolved',
        message: `Auto-resolved teaser → ${identity.playerSlug}`,
        details: { id: item.id, source: identity.source, confidence: identity.confidence, allowlist },
      });
    } catch {
      /* optional */
    }

    // Pass 3 — land on radar (watchlist/lab) immediately after naming.
    let radar = null;
    if (options.promoteRadar !== false) {
      try {
        const { promoteResolvedPredictionToRadar } = require('./lab-intel-promote');
        radar = await promoteResolvedPredictionToRadar({
          slug: identity.playerSlug,
          name: identity.playerName,
          classYear: identity.classYear || 2028,
          reasons: ['on3_rpm', 'teaser_identity'],
          sources: ['on3_rpm', 'teaser_identity', identity.source],
          fetchRpm: options.fetchRpm !== false,
        });
      } catch (err) {
        radar = { ok: false, error: err.message };
      }
    }

    return { enriched: true, autoResolved: true, identity, item: resolved.item, allowlist, radar };
  }

  try {
    require('./ops-monitor').logEvent({
      subsystem: 'recruiting:teaser-identity',
      status: 'suggested',
      message: `Suggested ${identity.playerSlug} for unresolved prediction`,
      details: { id: item.id, confidence: identity.confidence, source: identity.source },
    });
  } catch {
    /* optional */
  }
  return { enriched: true, autoResolved: false, identity, item: updated };
}

async function enrichOpenUnresolvedPredictions(options = {}) {
  const store = require('./unresolved-predictions-store');
  const listed = store.listItems({ status: 'open', limit: options.limit || 40 });
  const results = [];
  for (const item of listed.items) {
    if (item.suggestedSlug && !options.force) {
      results.push({ id: item.id, skipped: true, reason: 'already_suggested' });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    results.push({ id: item.id, ...(await enrichUnresolvedPredictionItem(item, options)) });
  }
  return {
    ok: true,
    scanned: listed.items.length,
    autoResolved: results.filter((r) => r.autoResolved).length,
    suggested: results.filter((r) => r.enriched && !r.autoResolved).length,
    results,
  };
}

module.exports = {
  ORG_TWITTER_NOISE,
  parseTagIdentity,
  parseFeaturedImageIdentity,
  extractCandidatesFromArticle,
  resolveIdentityFromPageProps,
  resolveIdentityFromOn3ArticleUrl,
  enrichUnresolvedPredictionItem,
  enrichOpenUnresolvedPredictions,
  extractHandles,
  playerSlugFromOn3Slug,
};
