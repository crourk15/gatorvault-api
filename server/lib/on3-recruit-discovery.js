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

function extractOn3RecruitSlug(url) {
  const m = String(url || '').match(ON3_RIVALS_RE);
  return m ? m[1].toLowerCase() : null;
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
  loadCanonicalOn3SlugMap,
  ON3_SLUG_MAP_PATH,
};
