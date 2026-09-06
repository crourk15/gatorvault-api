/**
 * Live GatorVault Film Review store — weekly Florida boards via API.
 * After the 1.0.23 fetch is in the binary, upserts go live without Codemagic.
 *
 * Bundle: server/data/film-room/reviews/<id>.json
 * Durable override on Render: /var/data/film-room/reviews/<id>.json
 *
 * Live gate (Harris-Payne / Charles): filmWatched + broadcast|all22.
 * Official PBP drafts stay off GET /api/film-room/reviews.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BUNDLE_DIR = path.join(__dirname, '..', 'data', 'film-room', 'reviews');
const RENDER_DIR = '/var/data/film-room/reviews';

function bundleDir() {
  const fromEnv = String(process.env.GV_FILM_REVIEW_BUNDLE_DIR || '').trim();
  return fromEnv || BUNDLE_DIR;
}

function durableDir() {
  const fromEnv = String(process.env.GV_FILM_REVIEW_DIR || '').trim();
  return fromEnv || RENDER_DIR;
}

function isLiveReview(review) {
  if (!review || review.filmWatched !== true) return false;
  return review.watchStandard === 'broadcast' || review.watchStandard === 'all22';
}

function slugId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asUnit(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    kicker: String(src.kicker || '').trim(),
    body: String(src.body || '').trim(),
    bullets: Array.isArray(src.bullets)
      ? src.bullets.map((b) => String(b || '').trim()).filter(Boolean)
      : [],
  };
}

function asSources(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const label = String(row?.label || '').trim();
      if (!label) return null;
      const url = String(row.url || '').trim();
      return url ? { label, url } : { label };
    })
    .filter(Boolean);
}

function normalizeReview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = slugId(raw.id);
  if (!id) return null;
  const watchStandard = String(raw.watchStandard || '').trim();
  if (!['official-pbp', 'broadcast', 'all22'].includes(watchStandard)) return null;
  const nextWeek = raw.nextWeek && typeof raw.nextWeek === 'object' ? raw.nextWeek : {};
  const review = {
    id,
    week: Number(raw.week) || 0,
    season: Number(raw.season) || 2026,
    gameId: String(raw.gameId || '').trim(),
    opponent: String(raw.opponent || '').trim(),
    opponentShort: String(raw.opponentShort || raw.opponent || '').trim(),
    dateLabel: String(raw.dateLabel || '').trim(),
    venue: String(raw.venue || '').trim(),
    finalUF: Number(raw.finalUF) || 0,
    finalOpp: Number(raw.finalOpp) || 0,
    title: String(raw.title || '').trim(),
    dek: String(raw.dek || '').trim(),
    filmWatched: raw.filmWatched === true,
    watchStandard,
    watchNote: String(raw.watchNote || '').trim(),
    sources: asSources(raw.sources),
    headline: String(raw.headline || '').trim(),
    offense: asUnit(raw.offense),
    defense: asUnit(raw.defense),
    specials: asUnit(raw.specials),
    keys: Array.isArray(raw.keys) ? raw.keys.map((k) => String(k || '').trim()).filter(Boolean) : [],
    schemeLessonIds: Array.isArray(raw.schemeLessonIds)
      ? raw.schemeLessonIds.map((k) => String(k || '').trim()).filter(Boolean)
      : [],
    nextWeek: {
      opponent: String(nextWeek.opponent || '').trim(),
      look: String(nextWeek.look || '').trim(),
    },
    publishedAt: String(raw.publishedAt || '').trim() || new Date().toISOString(),
  };
  if (raw.clipLabel != null && String(raw.clipLabel).trim()) {
    review.clipLabel = String(raw.clipLabel).trim();
  }
  if (raw.clipUrl != null && String(raw.clipUrl).trim()) {
    review.clipUrl = String(raw.clipUrl).trim();
  }
  if (!review.title || !review.opponent || !review.gameId) return null;
  return review;
}

function listJsonFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.startsWith('.'));
  } catch {
    return [];
  }
}

function loadFromDir(dir) {
  const byId = new Map();
  for (const name of listJsonFiles(dir)) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const review = normalizeReview(raw);
      if (review) byId.set(review.id, review);
    } catch {
      /* skip bad file */
    }
  }
  return byId;
}

function durableExists() {
  try {
    return fs.existsSync(durableDir());
  } catch {
    return false;
  }
}

function loadAll() {
  const bundled = loadFromDir(bundleDir());
  if (durableExists()) {
    for (const [id, review] of loadFromDir(durableDir())) {
      bundled.set(id, review);
    }
  }
  return [...bundled.values()];
}

function sortLive(reviews) {
  return [...reviews].sort((a, b) => {
    const tb = Date.parse(b.publishedAt) || 0;
    const ta = Date.parse(a.publishedAt) || 0;
    return tb - ta;
  });
}

function listLiveReviews() {
  return sortLive(loadAll().filter(isLiveReview));
}

function listAllReviews() {
  return sortLive(loadAll());
}

function getReviewById(id, { liveOnly = true } = {}) {
  const key = slugId(id);
  if (!key) return null;
  const match = loadAll().find((review) => review.id === key) || null;
  if (!match) return null;
  if (liveOnly && !isLiveReview(match)) return null;
  return match;
}

function getLiveReviewById(id) {
  return getReviewById(id, { liveOnly: true });
}

function updatedAt() {
  const reviews = loadAll();
  let latest = '';
  let latestMs = 0;
  for (const review of reviews) {
    const ms = Date.parse(review.publishedAt) || 0;
    if (ms >= latestMs) {
      latestMs = ms;
      latest = review.publishedAt;
    }
  }
  return latest || null;
}

function writeReviewFile(dir, review) {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${review.id}.json`);
  fs.writeFileSync(dest, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
  return dest;
}

function upsertReview(raw) {
  const review = normalizeReview(raw);
  if (!review) {
    throw new Error('Invalid film review — need id, gameId, opponent, title, and watchStandard');
  }
  const paths = [writeReviewFile(bundleDir(), review)];
  const durable = durableDir();
  const shouldWriteDurable =
    Boolean(String(process.env.GV_FILM_REVIEW_DIR || '').trim()) ||
    (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data'));
  if (shouldWriteDurable) {
    paths.push(writeReviewFile(durable, review));
  }
  return { review, live: isLiveReview(review), paths };
}

function toApiPayload() {
  const reviews = listLiveReviews();
  return {
    ok: true,
    reviews,
    count: reviews.length,
    updatedAt: updatedAt(),
  };
}

module.exports = {
  isLiveReview,
  normalizeReview,
  listLiveReviews,
  listAllReviews,
  getReviewById,
  getLiveReviewById,
  upsertReview,
  updatedAt,
  toApiPayload,
  bundleDir,
  durableDir,
};
