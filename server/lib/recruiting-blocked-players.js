/**
 * Admin-purged recruiting identities — must never appear in UI or ingest.
 * Also hard-blocks UF coaching staff, current roster, and alumni/legend
 * phantoms so Desk never soft-creates them as 2028 chase targets
 * (e.g. urban-meyer / kyle-trask / dallas-wilson on Priority Chase).
 */
const { slugify } = require('./slug');

const BLOCKED_PLAYER_SLUGS = new Set([
  'jaylen-jordan',
  'kennedee-jackson',
  'tj-shanahan-jr',
  't-j-shanahan',
  // Current UF roster OL (#53, R-Jr) — Desk soft-created a phantom 2028 ATH commit.
  'bryce-lovett',
  'devon-hall',
  'derrick-malone',
  'camron-cooper',
  'jordan-williams',
  'trey-morrison',
  'malik-clark',
  'michael-johnson-jr',
  // UF staff coach-name collisions (Desk / On3 coach rows mistaken for recruits).
  'brandon-harris',
  'phil-trautwein',
  'chris-foster',
  // Alumni / legends / roster bleed seen on 2028 Priority Chase (empty ATH shells).
  'urban-meyer',
  'kyle-trask',
  'percy-harvin',
  'ocyrus-torrence',
  'o-cyrus-torrence',
  'chauncey-gardner-johnson',
  'dallas-wilson',
  'jadan-baugh',
  'tramell-jones',
  'tramell-jones-jr',
  'joseph-putu',
  'aaron-gates',
  'brendan-bett',
  'keagan-covington',
  'vernell-brown-iii',
  'lagonza-hayward',
  'grayson-clary',
  'kofi-asare',
  'aj-tuivaiave',
  'amos-augustine',
  'caiden-bellard',
  'caden-jones',
  'cole-best',
  'jayden-wade',
  'andrew-whittemore',
]);

const BLOCKED_PLAYER_NAMES = new Set([
  'camron cooper',
  'jordan williams',
  'trey morrison',
  'trey morrions',
  'malik clark',
  'michael johnson jr.',
  'michael johnson jr',
  'bryce lovett',
  'brandon harris',
  'phil trautwein',
  'chris foster',
  'urban meyer',
  'kyle trask',
  'percy harvin',
  "o'cyrus torrence",
  'ocyrus torrence',
  'chauncey gardner-johnson',
  'chauncey gardner johnson',
  'dallas wilson',
  'jadan baugh',
  'tramell jones',
  'tramell jones jr',
  'tramell jones jr.',
  'joseph putu',
  'aaron gates',
  'brendan bett',
  'keagan covington',
  'vernell brown iii',
  'lagonza hayward',
  'grayson clary',
  'kofi asare',
  'aj tuivaiave',
  'amos augustine',
  'caiden bellard',
  'caden jones',
  'cole best',
  'jayden wade',
  'andrew whittemore',
]);

function normalizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function rosterSlugCandidates(slug) {
  const s = normalizeSlug(slug);
  if (!s) return [];
  const out = new Set([s]);
  if (s.endsWith('-jr')) out.add(s.replace(/-jr$/, ''));
  else out.add(`${s}-jr`);
  if (s.endsWith('-ii')) out.add(s.replace(/-ii$/, ''));
  else out.add(`${s}-ii`);
  if (s.endsWith('-iii')) out.add(s.replace(/-iii$/, ''));
  else out.add(`${s}-iii`);
  return [...out];
}

/** Current UF roster hit (exact slug or Jr/II/III variant). */
function currentRosterRecruitCollision(player) {
  try {
    const rosterStore = require('./roster-store');
    const slug = normalizeSlug(player?.slug || player?.id || slugify(player?.name));
    for (const cand of rosterSlugCandidates(slug)) {
      const hit = rosterStore.getRosterPlayerBySlug(cand);
      if (hit) return hit;
    }
    const name = String(player?.name || player?.playerName || '')
      .trim()
      .toLowerCase()
      .replace(/\./g, '');
    if (!name) return null;
    const all = rosterStore.getAllRosterPlayers() || [];
    return (
      all.find((r) => {
        const rn = String(r.name || '')
          .trim()
          .toLowerCase()
          .replace(/\./g, '');
        return rn && rn === name;
      }) || null
    );
  } catch {
    return null;
  }
}

/**
 * Empty ATH shells with zero industry signal — alumni/legend bleed pattern
 * seen on Priority Chase (Urban Meyer, Kyle Trask, etc.).
 * Requires a display name so slug-only allowlist probes are not false-positives.
 */
function isEmptyAthPhantomShell(player) {
  if (!player || typeof player !== 'object') return false;
  const name = String(player.name || player.playerName || '').trim();
  if (!name) return false;
  const school = String(player.school || player.highSchool || player.high_school || '').trim();
  if (school && school !== '—' && school.toLowerCase() !== 'n/a') return false;
  // Explicit ATH only — missing pos on a name probe must not wipe real targets.
  const pos = String(player.pos || player.position || '')
    .trim()
    .toUpperCase();
  if (pos !== 'ATH') return false;
  const uf = Number(
    player.ufProbability ?? player.ufPct ?? player.ufRpmPct ?? player.ufConfidence ?? 0
  );
  if (Number.isFinite(uf) && uf > 0) return false;
  const stars = Number(player.stars || 0);
  if (Number.isFinite(stars) && stars >= 1) return false;
  const natl = player.nationalRank ?? player.natlRank ?? player.national_rank;
  if (natl != null && Number(natl) > 0) return false;
  const composite = Number(player.compositeScore ?? player.composite ?? player.rating ?? 0);
  if (Number.isFinite(composite) && composite > 0) return false;
  return true;
}

function isBlockedRecruit(player) {
  if (!player) return false;
  const slug = normalizeSlug(player.slug || player.id || slugify(player.name));
  if (slug && BLOCKED_PLAYER_SLUGS.has(slug)) return true;
  for (const cand of rosterSlugCandidates(slug)) {
    if (BLOCKED_PLAYER_SLUGS.has(cand)) return true;
  }
  const name = String(player.name || player.playerName || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
  if (name && BLOCKED_PLAYER_NAMES.has(name)) return true;
  try {
    const staff = require('./recruiting-staff-directory');
    if (slug && staff.isStaffPlayerSlug(slug)) return true;
    if (name && staff.isStaffOrCoachName(name)) return true;
  } catch {
    /* optional */
  }
  if (currentRosterRecruitCollision(player)) return true;
  if (isEmptyAthPhantomShell(player)) return true;
  return false;
}

function filterBlockedRecruits(list) {
  return (list || []).filter((p) => !isBlockedRecruit(p));
}

module.exports = {
  BLOCKED_PLAYER_SLUGS,
  BLOCKED_PLAYER_NAMES,
  isBlockedRecruit,
  filterBlockedRecruits,
  isEmptyAthPhantomShell,
  currentRosterRecruitCollision,
  rosterSlugCandidates,
};
