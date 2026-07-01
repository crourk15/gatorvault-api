/**
 * Discover On3 recruit profile slugs for allowlist targets.
 */
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const on3Recruit = require('./on3-recruit-client');
const { slugify } = require('./slug');
const { CANONICAL_TARGET_NAMES } = require('./recruiting-target-allowlist');

const ON3_SLUG_MAP_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'on3-allowlist-slugs-2028.json');

let cachedSlugMap = null;

function loadCanonicalOn3SlugMap() {
  if (cachedSlugMap) return cachedSlugMap;
  try {
    const doc = JSON.parse(fs.readFileSync(ON3_SLUG_MAP_PATH, 'utf8'));
    cachedSlugMap = doc.slugs || {};
  } catch {
    cachedSlugMap = {};
  }
  return cachedSlugMap;
}

const ON3_RIVALS_RE = /on3\.com\/rivals\/([a-z0-9-]+-\d+)\/?/i;
const ON3_URL_IN_TEXT_RE = /https?:\/\/(?:www\.)?on3\.com\/[^\s)\]"'<>]+/gi;
const ON3_NEWS_PATH_RE = /on3\.com\/(?:teams\/[^/]+\/)?news\/([^/?#]+)/i;
const ON3_POS_WORD = {
  'wide-receiver': 'WR',
  'running-back': 'RB',
  'quarterback': 'QB',
  'tight-end': 'TE',
  'linebacker': 'LB',
  'defensive-end': 'DE',
  'defensive-tackle': 'DT',
  'cornerback': 'CB',
  safety: 'S',
  athlete: 'ATH',
  'offensive-tackle': 'OT',
  'offensive-guard': 'OG',
  center: 'C',
};
const US_STATE_ABBR = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'ia', 'id', 'il', 'in', 'ks', 'ky', 'la',
  'ma', 'md', 'me', 'mi', 'mn', 'mo', 'ms', 'mt', 'nc', 'nd', 'ne', 'nh', 'nj', 'nm', 'nv', 'ny', 'oh', 'ok',
  'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'va', 'vt', 'wa', 'wi', 'wv', 'wy', 'dc',
]);
const PERSON_SLUG_NOISE = new Set([
  'florida', 'gators', 'gator', 'teams', 'team', 'news', 'star', 'stars', 'major', 'contender', 'contenders',
  'interest', 'priority', 'top', 'high', 'school', 'football', 'recruiting', 'visit', 'official', 'unofficial',
]);
const POS_SLUG_PREFIX = new Set([
  'wr', 'qb', 'rb', 'te', 'ol', 'ot', 'og', 'c', 'dl', 'dt', 'de', 'edge', 'lb', 'cb', 's', 'ath', 'k', 'p',
  'safety', 'receiver', 'back', 'end', 'tackle', 'guard', 'center', 'linebacker', 'cornerback', 'quarterback',
  'athlete', 'ranked', 'no',
]);

function extractOn3RecruitSlug(url) {
  const m = String(url || '').match(ON3_RIVALS_RE);
  return m ? m[1].toLowerCase() : null;
}

function extractOn3UrlsFromText(text) {
  return [...new Set(String(text || '').match(ON3_URL_IN_TEXT_RE) || [])];
}

function cleanOn3Url(url) {
  return String(url || '')
    .replace(/[\s)\]"'<>]+$/g, '')
    .replace(/\?$/, '');
}

function slugToPlayerName(slug) {
  const base = String(slug || '')
    .replace(/-\d+$/, '')
    .trim();
  return base
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isLikelyPersonSlug(slug) {
  const parts = String(slug || '')
    .split('-')
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) return parts.length >= 3;
  if (US_STATE_ABBR.has(last)) return false;
  if (parts.some((p) => PERSON_SLUG_NOISE.has(p))) return false;
  if (POS_SLUG_PREFIX.has(parts[0])) return false;
  return parts.every((p) => /^[a-z]{2,}$/.test(p));
}

function parseOn3NewsArticleSlug(pathSlug) {
  const slug = String(pathSlug || '')
    .toLowerCase()
    .replace(/\/$/, '');
  if (!slug) return null;

  let m = slug.match(/(\d)-star-(wr|qb|rb|te|ol|ot|og|c|dl|dt|de|edge|lb|cb|s|ath|k|p)-([a-z0-9-]+)$/i);
  if (m) {
    const playerSlug = m[3].replace(/-\d+$/, '');
    if (!isLikelyPersonSlug(playerSlug)) return null;
    return {
      playerSlug,
      playerName: slugToPlayerName(playerSlug),
      stars: parseInt(m[1], 10),
      pos: m[2].toUpperCase(),
      classYear: null,
    };
  }

  m = slug.match(
    /(\d)-star-(wide-receiver|running-back|quarterback|tight-end|linebacker|defensive-end|defensive-tackle|cornerback|safety|athlete|offensive-tackle|offensive-guard|center)-([a-z0-9-]+)$/i
  );
  if (m) {
    const playerSlug = m[3].replace(/-\d+$/, '');
    if (!isLikelyPersonSlug(playerSlug)) return null;
    return {
      playerSlug,
      playerName: slugToPlayerName(playerSlug),
      stars: parseInt(m[1], 10),
      pos: ON3_POS_WORD[m[2].toLowerCase()] || null,
      classYear: null,
    };
  }

  m = slug.match(/\bno-\d+-(wr|qb|rb|te|ol|ot|og|c|dl|dt|de|edge|lb|cb|s|ath|k|p)-([a-z0-9-]+)$/i);
  if (m) {
    const playerSlug = m[2].replace(/-\d+$/, '');
    if (!isLikelyPersonSlug(playerSlug)) return null;
    return {
      playerSlug,
      playerName: slugToPlayerName(playerSlug),
      stars: null,
      pos: m[1].toUpperCase(),
      classYear: null,
    };
  }

  m = slug.match(
    /\b(202[6-9]|203[0-5])-(\d)-star-(wide-receiver|running-back|quarterback|tight-end|linebacker|defensive-end|defensive-tackle|cornerback|safety|athlete|offensive-tackle|offensive-guard|center)-([a-z0-9-]+)/i
  );
  if (m) {
    const playerSlug = m[4].replace(/-\d+$/, '');
    if (!isLikelyPersonSlug(playerSlug)) return null;
    return {
      playerSlug,
      playerName: slugToPlayerName(playerSlug),
      stars: parseInt(m[2], 10),
      pos: ON3_POS_WORD[m[3].toLowerCase()] || null,
      classYear: parseInt(m[1], 10),
    };
  }

  m = slug.match(/\bfor-(edge|wr|qb|rb|te|ol|ot|og|c|dl|dt|de|lb|cb|s|ath|k|p)-target-([a-z0-9-]+)$/i);
  if (m) {
    const playerSlug = m[2].replace(/-\d+$/, '');
    if (!isLikelyPersonSlug(playerSlug)) return null;
    return {
      playerSlug,
      playerName: slugToPlayerName(playerSlug),
      stars: null,
      pos: m[1].toUpperCase(),
      classYear: null,
    };
  }

  return null;
}

function parseOn3BeatUrlIdentity(text, postUrl) {
  const urls = extractOn3UrlsFromText(text).map(cleanOn3Url);
  if (postUrl && /on3\.com/i.test(postUrl)) urls.push(cleanOn3Url(postUrl));

  for (const url of urls) {
    const rivalsSlug = extractOn3RecruitSlug(url);
    if (rivalsSlug) {
      const playerSlug = rivalsSlug.replace(/-\d+$/, '');
      return {
        playerSlug,
        playerName: slugToPlayerName(playerSlug),
        on3RecruitSlug: rivalsSlug,
        on3ArticleUrl: url,
        source: 'on3_rivals_url',
      };
    }

    const newsMatch = url.match(ON3_NEWS_PATH_RE);
    if (newsMatch) {
      const parsed = parseOn3NewsArticleSlug(newsMatch[1]);
      if (parsed) {
        return {
          ...parsed,
          on3ArticleUrl: url,
          source: 'on3_news_url',
        };
      }
    }
  }

  return null;
}

function normalizeNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function nameMatchesProfile(profileName, expectedName) {
  const a = normalizeNameKey(profileName);
  const b = normalizeNameKey(expectedName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const lastA = String(profileName || '')
    .trim()
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z]/g, '');
  const lastB = String(expectedName || '')
    .trim()
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z]/g, '');
  return Boolean(lastA && lastB && lastA === lastB);
}

function resolveStoredOn3Slug(player) {
  if (!player) return null;
  const on3Slug = String(player.on3Slug || player.on3_slug || '').trim().toLowerCase();
  if (on3Slug && /-\d+$/.test(on3Slug)) return on3Slug;

  const on3Id = String(player.on3Id || player.on3_id || '').trim();
  if (/^\d+$/.test(on3Id)) {
    const base = slugify(player.name || player.slug || '');
    return `${base.replace(/-\d+$/, '')}-${on3Id}`;
  }

  const slug = String(player.slug || '').trim().toLowerCase();
  if (/-\d+$/.test(slug)) return slug;
  return null;
}

async function searchOn3ProfileUrls(name, classYear, pos) {
  const queries = [
    `site:on3.com/rivals ${name} ${classYear} football`,
    `site:on3.com/rivals ${name} ${classYear}`,
    `site:on3.com/rivals ${name} ${pos || ''}`.trim(),
    `site:on3.com/rivals ${name}`,
  ];
  const seen = new Set();
  const urls = [];

  for (const q of queries) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const html = await res.text();
      const re = /uddg=([^&"]+)/g;
      let m;
      while ((m = re.exec(html))) {
        try {
          const link = decodeURIComponent(m[1]);
          if (!link.includes('on3.com/rivals/')) continue;
          if (seen.has(link)) continue;
          seen.add(link);
          urls.push(link);
        } catch {
          /* skip */
        }
      }
    } catch {
      /* optional */
    }
    if (urls.length) break;
  }

  return urls;
}

async function discoverOn3RecruitSlug(slug, options = {}) {
  const classYear = Number(options.classYear) || 2028;
  const player = options.player || null;
  const name = options.name || CANONICAL_TARGET_NAMES[slug] || player?.name || slug;
  const pos = options.pos || player?.pos || null;

  const stored = resolveStoredOn3Slug(player);
  const canonicalMap = loadCanonicalOn3SlugMap();
  const mappedSlug = canonicalMap[String(slug || '').toLowerCase()] || null;

  for (const candidate of [stored, mappedSlug]) {
    if (!candidate) continue;
    const profile = await on3Recruit.fetchRecruitProfile(candidate, classYear);
    if (profile && !profile.error && nameMatchesProfile(profile.name, name)) {
      return { recruitSlug: candidate, profile, source: mappedSlug === candidate ? 'slug_map' : 'stored_slug' };
    }
  }

  if (mappedSlug || process.env.ON3_DISCOVERY_SKIP_SEARCH === 'true') {
    return { recruitSlug: mappedSlug || stored || null, profile: null, source: null, name };
  }

  const urls = await searchOn3ProfileUrls(name, classYear, pos);
  for (const url of urls) {
    const recruitSlug = extractOn3RecruitSlug(url);
    if (!recruitSlug) continue;
    const profile = await on3Recruit.fetchRecruitProfile(recruitSlug, classYear);
    if (profile?.error) continue;
    if (!nameMatchesProfile(profile.name, name)) continue;
    return { recruitSlug, profile, source: 'search' };
  }

  return { recruitSlug: null, profile: null, source: null, name };
}

function formatRecruitSchoolLabel(school, state) {
  const trimmed = String(school || '').trim();
  if (!trimmed) return null;
  const st = String(state || '').trim().toUpperCase();
  if (st && !new RegExp(`\\b${st}\\b`, 'i').test(trimmed)) {
    return `${trimmed}, ${st}`;
  }
  return trimmed;
}

function profileToSchoolPatch(profile) {
  if (!profile || profile.error) return {};
  let state = profile.state ? String(profile.state).trim().toUpperCase() : null;
  if (!state && /img academy/i.test(String(profile.school || ''))) state = 'FL';
  const school = formatRecruitSchoolLabel(profile.school, state);
  const patch = {
    school: school || null,
    state,
    hometownCity: profile.hometownCity || null,
    hometownState: state,
    inState: state === 'FL',
  };

  if (profile.pos) {
    patch.pos = String(profile.pos).trim().toUpperCase();
  }

  if (profile.rating != null && Number.isFinite(Number(profile.rating))) {
    patch.rating = Number(profile.rating);
    patch.stars = profile.stars ?? null;
    patch.natlRank = profile.natlRank ?? null;
    patch.posRank = profile.posRank ?? null;
    patch.stateRank = profile.stateRank ?? null;
    patch.on3Source = 'on3-board-sync';
  }

  if (profile.slug) {
    patch.on3Slug = profile.slug;
    const idMatch = String(profile.slug).match(/-(\d+)$/);
    if (idMatch) patch.on3Id = idMatch[1];
  }

  return patch;
}

module.exports = {
  discoverOn3RecruitSlug,
  profileToSchoolPatch,
  formatRecruitSchoolLabel,
  resolveStoredOn3Slug,
  extractOn3RecruitSlug,
  extractOn3UrlsFromText,
  parseOn3NewsArticleSlug,
  parseOn3BeatUrlIdentity,
  loadCanonicalOn3SlugMap,
  ON3_SLUG_MAP_PATH,
};
