/**
 * Charles' locked UF target allow-list — ONLY these slugs may appear as targets.
 * No fallback, mock, synthetic, or AI-generated names.
 */
const { slugify } = require('./slug');

/** Display name → canonical slug (handles typos / aliases) */
const SLUG_ALIASES = {
  'kamaui-whifield': 'kamauri-whitfield',
  'kamauri-whitfield': 'kamauri-whitfield',
};

/** Locked 2027 target slugs */
const ALLOWLIST_2027 = [
  'easton-royal',
  'jalen-brewster',
  'raheem-floyd',
  'marquis-evans',
  'tre-geathers',
  'adryan-cole',
  'tranard-roberts',
  'jordan-christie',
  'andre-hyppolite',
  'kyren-caldwell',
  'tk-cunningham',
  'kamauri-whitfield',
  'jameer-cantrell',
  'kaleb-exume',
  'elijah-guertin',
  'james-bethea',
];

/** Locked 2028 target slugs */
const ALLOWLIST_2028 = [
  'kaleb-ballard',
  'brysen-wright',
  'asher-ghioto',
  'cassell-cruickshank',
  'prince-che',
  'gabriel-player',
  'andre-alexander',
  'bubba-brown',
  'xander-edwards',
  'izayah-vickers',
  'malakhi-dudley',
  'braxton-rein',
  'taihj-moore',
  'armani-strong',
  'tristin-gaines',
  'tristian-henderson',
  'dominick-harris-payne',
  'brady-quinn',
  'john-matthews',
  'bryce-willingham',
  'quinton-rolle-jr',
  'jordon-gorham',
  'kahmaree-crumity',
  'pj-evans',
  'anthony-howard-jr',
];

const BY_YEAR = {
  2027: new Set(ALLOWLIST_2027),
  2028: new Set(ALLOWLIST_2028),
};

const ALL_ALLOWED = new Set([...ALLOWLIST_2027, ...ALLOWLIST_2028]);

function canonicalTargetSlug(rawSlug) {
  const s = String(rawSlug || '').trim().toLowerCase();
  return SLUG_ALIASES[s] || s;
}

function isAllowlistedTarget(player) {
  if (!player) return false;
  const year = parseInt(player.classYear || player.class_year, 10);
  const set = BY_YEAR[year];
  if (!set) return false;
  const slug = canonicalTargetSlug(player.slug || slugify(player.name));
  return set.has(slug);
}

function filterAllowlistedTargets(targets, classYear) {
  const year = parseInt(classYear, 10);
  const set = BY_YEAR[year];
  if (!set) return [];
  return (targets || []).filter((p) => {
    const slug = canonicalTargetSlug(p.slug || slugify(p.name));
    return set.has(slug);
  });
}

function validateStoreTargets(players) {
  const errors = [];
  for (const p of players || []) {
    if (p.category !== 'target') continue;
    const year = parseInt(p.classYear || p.class_year, 10);
    if (year !== 2027 && year !== 2028) continue;
    const slug = canonicalTargetSlug(p.slug || slugify(p.name));
    const set = BY_YEAR[year];
    if (!set || !set.has(slug)) {
      errors.push({
        slug,
        name: p.name,
        classYear: year,
        reason: 'not_on_charles_allowlist',
      });
    }
  }
  return errors;
}

module.exports = {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  ALL_ALLOWED,
  canonicalTargetSlug,
  isAllowlistedTarget,
  filterAllowlistedTargets,
  validateStoreTargets,
};
