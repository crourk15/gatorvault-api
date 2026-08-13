/**
 * Guard against slug/name identity collisions
 * (e.g. jamarcus-johnson row storing Kamarion Johnson's Clinch County ATH card).
 */
'use strict';

const { slugify } = require('./slug');

const KNOWN_COLLISION_FIXES = [
  {
    // Wrong: Beat Desk soft-wrote Kamarion under Jamarcus's slug.
    badSlug: 'jamarcus-johnson',
    wrongNameRe: /^kamarion\b/i,
    correct: {
      slug: 'jamarcus-johnson',
      name: 'Jamarcus Johnson',
      classYear: 2028,
      pos: 'DL',
      on3Slug: 'jamarcus-johnson-260924',
      school: 'Toombs County',
      htWt: '6-5 / 330',
      state: 'GA',
    },
    kamarionSlug: 'kamarion-johnson',
  },
  {
    // Wrong: Beat Desk Open attached Tramond Collins (On3 258942 / Cottondale WR)
    // under DeNairo Girton Jr. (Great Mills MD S / On3 283189).
    badSlug: 'denairo-girton-jr',
    wrongNameRe: /^tramond\b/i,
    wrongOn3Ids: ['258942'],
    correct: {
      slug: 'denairo-girton-jr',
      name: 'DeNairo Girton Jr.',
      classYear: 2028,
      pos: 'S',
      on3Id: '283189',
      on3Slug: 'denairo-girton-jr-283189',
      school: 'Great Mills (Lexington Park, MD)',
      htWt: '6-1 / 180',
      state: 'MD',
    },
    collinsSlug: 'tramond-collins',
  },
];

function normalizeNameTokens(slugOrName) {
  const s = String(slugOrName || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s ? s.split('-').filter(Boolean) : [];
}

function firstNameToken(slugOrName) {
  return normalizeNameTokens(slugOrName)[0] || '';
}

/** Compact initial prefix from name: "T.J. Shanahan" → "tj", "K.J. Green" → "kj". */
function initialCompact(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  // T.J. / T.J / TJ Shanahan
  const m = raw.match(/^([A-Za-z])\.?\s*([A-Za-z])\.?\b/);
  if (m) return `${m[1]}${m[2]}`.toLowerCase();
  return '';
}

/**
 * True when slug first-name token clearly disagrees with player name first-name.
 * Allows Jr/II suffixes, hyphenated last names, and initialed names (T.J., K.J.).
 */
function hasSlugNameFirstMismatch(player) {
  if (!player) return false;
  const slug = String(player.slug || player.id || '')
    .trim()
    .toLowerCase();
  const name = String(player.name || player.playerName || player.fullName || '').trim();
  if (!slug || !name) return false;

  const slugToks = normalizeNameTokens(slug);
  const nameToks = normalizeNameTokens(slugify(name) || name);
  const slugFirst = slugToks[0] || '';
  const nameFirst = nameToks[0] || '';
  if (!slugFirst || !nameFirst) return false;
  if (slugFirst === nameFirst) return false;

  // Initialed legal names: slug "tj-shanahan" vs name "T.J. Shanahan"
  const initials = initialCompact(name);
  if (initials && (slugFirst === initials || slug.startsWith(`${initials}-`))) return false;

  // Nickname / short forms: jo / joseph
  if (slugFirst.length >= 3 && nameFirst.length >= 3) {
    if (slugFirst.startsWith(nameFirst) || nameFirst.startsWith(slugFirst)) return false;
  }

  // Last-name agreement alone is not enough when first names clearly differ
  // (jamarcus-johnson vs Kamarion Johnson both end in johnson).
  return true;
}

function explainSlugNameMismatch(player) {
  if (!hasSlugNameFirstMismatch(player)) return null;
  return {
    reason: 'slug_name_first_mismatch',
    slug: String(player.slug || '').toLowerCase(),
    name: String(player.name || player.playerName || ''),
    slugFirst: firstNameToken(player.slug),
    nameFirst: firstNameToken(slugify(player.name || player.playerName || '')),
  };
}

module.exports = {
  KNOWN_COLLISION_FIXES,
  firstNameToken,
  initialCompact,
  hasSlugNameFirstMismatch,
  explainSlugNameMismatch,
};
