/**
 * Charles' locked UF target allow-list for curated Lab / hub targets.
 *
 * 2027 Closing Class is hunt-list only — never a 247 "Florida offered" dump.
 * 247 sync still marks dead commits / UF commits; it does not expand the target board.
 */
const { slugify } = require('./slug');
const { isActiveUfTarget } = require('./recruiting-target-filters');

/**
 * Locked 2027 Closing Class targets — intentional remaining battles / flips only.
 * Dead elsewhere-commits and UF commits do not belong here.
 * Offer-list / soft 247 open rows are not board membership.
 */
const ALLOWLIST_2027 = [
  'jalen-brewster', // 5★ DT — Texas Tech commit, active UF flip watch
  'tranard-roberts', // still open — in-state RB UF is actively hunting
];

/** Allowlisted 2027 names that stay on the board after committing elsewhere (flip radar). */
const FLIP_WATCH_2027 = ['jalen-brewster'];

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
  'merrick-ham',
  'braxton-rein',
  'landon-dawson',
  'taihj-moore',
  'armani-strong',
  'tristin-gaines',
  'tristian-henderson',
  'dominick-harris-payne',
  'cyion-smith',
  'brady-quinn',
  'john-matthews',
  'bryce-willingham',
  'quinton-rolle-jr',
  'jordon-gorham',
  'kahmaree-crumity',
  'pj-evans',
  'anthony-howard-jr',
  'joey-fleming',
  // Corey Bender / beat board — UF push / offer names that must stay locked
  'lorenzo-mcmullen-jr',
  'jordyn-murray',
  'hudson-west',
  'nikolay-petrushev',
  // Tyler Harden / 247 — daily contact, visits, recent UF offers
  'kaydan-whiteside',
  'ridge-janes',
  'zaiden-jernigan',
  'nate-dollard',
];

/** Charles' display names — used for On3/Rivals/247 identity lookup (never synthetic cards). */
const CANONICAL_TARGET_NAMES = {
  'easton-royal': 'Easton Royal',
  'jalen-brewster': 'Jalen Brewster',
  'raheem-floyd': 'Raheem Floyd',
  'marquis-evans': 'Marquis Evans',
  'tre-geathers': 'Tre Geathers',
  'adryan-cole': 'Adryan Cole',
  'tranard-roberts': 'Tranard Roberts',
  'jordan-christie': 'Jordan Christie',
  'andre-hyppolite': 'Andre Hyppolite',
  'kyren-caldwell': 'Kyren Caldwell',
  'tk-cunningham': 'T.K. Cunningham',
  'kamauri-whitfield': 'Kamauri Whitfield',
  'jameer-cantrell': 'Jameer Cantrell',
  'elijah-guertin': 'Elijah Guertin',
  'james-bethea': 'James Bethea',
  'kaleb-ballard': 'Kaleb Ballard',
  'brysen-wright': 'Brysen Wright',
  'asher-ghioto': 'Asher Ghioto',
  'cassell-cruickshank': 'Cassell Cruickshank',
  'prince-che': 'Prince Che',
  'gabriel-player': 'Gabriel Player',
  'andre-alexander': 'Andre Alexander',
  'bubba-brown': 'Bubba Brown',
  'xander-edwards': 'Xander Edwards',
  'izayah-vickers': 'Izayah Vickers',
  'malakhi-dudley': 'Malakhi Dudley',
  'merrick-ham': 'Merrick Ham',
  'braxton-rein': 'Braxton Rein',
  'landon-dawson': 'Landon Dawson',
  'taihj-moore': 'Taihj Moore',
  'armani-strong': 'Armani Strong',
  'tristin-gaines': 'Tristin Gaines',
  'tristian-henderson': 'Tristian Henderson',
  'dominick-harris-payne': 'Dominick Harris-Payne',
  'cyion-smith': 'Cyion Smith',
  'brady-quinn': 'Brady Quinn',
  'john-matthews': 'John Matthews',
  'bryce-willingham': 'Bryce Willingham',
  'quinton-rolle-jr': 'Quinton Rolle Jr.',
  'jordon-gorham': 'Jordon Gorham',
  'kahmaree-crumity': 'Kahmaree Crumity',
  'pj-evans': 'PJ Evans',
  'anthony-howard-jr': 'Anthony Howard Jr.',
  'joey-fleming': 'Joey Fleming',
  'lorenzo-mcmullen-jr': 'Lorenzo McMullen Jr.',
  'jordyn-murray': 'Jordyn Murray',
  'hudson-west': 'Hudson West',
  'nikolay-petrushev': 'Nikolay Petrushev',
  'kaydan-whiteside': 'Kaydan Whiteside',
  'ridge-janes': 'Ridge Janes',
  'zaiden-jernigan': 'Zaiden Jernigan',
  'nate-dollard': 'Nate Dollard',
};

/** Display name → canonical slug (handles typos / aliases) */
const SLUG_ALIASES = {
  'kamaui-whifield': 'kamauri-whitfield',
  'kamauri-whitfield': 'kamauri-whitfield',
  't-k-cunningham': 'tk-cunningham',
};

function loadAdminAllowlistSlugs() {
  try {
    return require('./admin-allowlist-store').loadAdminAllowlist();
  } catch {
    return { slugs2027: [], slugs2028: [], names: {} };
  }
}

function loadLabPromotionSlugs(classYear) {
  try {
    return [...require('./lab-promotions-store').getLabSlugSet(classYear)];
  } catch {
    return [];
  }
}

function getAllowlistSet(classYear) {
  const year = parseInt(classYear, 10);
  const admin = loadAdminAllowlistSlugs();
  const base = year === 2027 ? ALLOWLIST_2027 : year === 2028 ? ALLOWLIST_2028 : [];
  const extra = year === 2027 ? admin.slugs2027 : year === 2028 ? admin.slugs2028 : [];
  // Closing Class is nearly done — do not auto-expand 2027 with Lab soft-visit promotions.
  // 2028 still merges Lab promotions for elite offer/visit discovery.
  const promoted = year === 2028 ? loadLabPromotionSlugs(year) : [];
  return new Set([...base, ...extra, ...promoted].map((s) => canonicalTargetSlug(s)));
}

function isFlipWatchAllowlisted(slug, classYear) {
  const year = parseInt(classYear, 10);
  const key = canonicalTargetSlug(slug);
  if (!key) return false;
  if (year === 2027) return FLIP_WATCH_2027.includes(key);
  return false;
}

function getMergedCanonicalNames() {
  const admin = loadAdminAllowlistSlugs();
  return { ...CANONICAL_TARGET_NAMES, ...(admin.names || {}) };
}

const ALL_ALLOWED = new Set([...ALLOWLIST_2027, ...ALLOWLIST_2028]);

function canonicalTargetSlug(rawSlug) {
  const s = String(rawSlug || '').trim().toLowerCase();
  return SLUG_ALIASES[s] || s;
}

function isAllowlistedTarget(player) {
  if (!player) return false;
  const year = parseInt(player.classYear || player.class_year, 10);
  const set = getAllowlistSet(year);
  if (!set.size) return false;
  const slug = canonicalTargetSlug(player.slug || slugify(player.name));
  return set.has(slug);
}

function filterAllowlistedTargets(targets, classYear) {
  const year = parseInt(classYear, 10);
  const set = getAllowlistSet(year);
  const { isFloridaSchool, resolveCommittedTo } = require('./recruiting-target-filters');
  return (targets || []).filter((p) => {
    const slug = canonicalTargetSlug(p.slug || slugify(p.name));
    const flipWatch = set.has(slug) && isFlipWatchAllowlisted(slug, year);
    if (flipWatch) {
      // Flip radar: keep intentional elsewhere-commits, never UF commits.
      if (isFloridaSchool(resolveCommittedTo(p))) return false;
      return true;
    }
    if (!isActiveUfTarget(p)) return false;
    // Hunt list only — no 247 offer-list expansion for Closing Class.
    return set.has(slug);
  });
}

function validateStoreTargets(players) {
  const errors = [];
  for (const p of players || []) {
    if (p.category !== 'target') continue;
    if (!isActiveUfTarget(p)) continue;
    const year = parseInt(p.classYear || p.class_year, 10);
    if (year !== 2027 && year !== 2028) continue;
    const slug = canonicalTargetSlug(p.slug || slugify(p.name));
    const set = getAllowlistSet(year);
    if (set.has(slug)) continue;
    errors.push({
      slug,
      name: p.name,
      classYear: year,
      reason: 'not_on_charles_allowlist',
    });
  }
  return errors;
}

/** Demote board targets that are not on Charles' allow-list (keeps row, removes from target board). */
function demoteNonAllowlistedTargets(players) {
  let demoted = 0;
  for (const p of players || []) {
    if (p.category !== 'target') continue;
    const year = parseInt(p.classYear || p.class_year, 10);
    if (year !== 2027 && year !== 2028) continue;
    const slug = canonicalTargetSlug(p.slug || slugify(p.name));
    const set = getAllowlistSet(year);
    if (set.has(slug)) continue;
    p.category = 'recruit';
    if (!p.status || p.status === 'target') p.status = 'uncommitted';
    demoted += 1;
  }
  return demoted;
}

module.exports = {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  FLIP_WATCH_2027,
  CANONICAL_TARGET_NAMES,
  ALL_ALLOWED,
  canonicalTargetSlug,
  loadAdminAllowlistSlugs,
  getAllowlistSet,
  getMergedCanonicalNames,
  isAllowlistedTarget,
  isFlipWatchAllowlisted,
  filterAllowlistedTargets,
  validateStoreTargets,
  demoteNonAllowlistedTargets,
};
