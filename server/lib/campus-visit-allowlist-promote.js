/**
 * Product rule (Charles):
 *   Beat + Florida offer → War Room / profile / early-watch monitor is fine.
 *   Any Florida campus visit set up (scheduled or logged) → MUST land on the
 *   2028 admin allowlist so Chase + Closest to Commit can rank them.
 *
 * Soft beat "visit" pollution is ignored — only scheduled/official/unofficial/
 * completed OV status, visit windows, visit trails, or Florida visit logs.
 */
'use strict';

const { isFloridaSchool } = require('./recruiting-target-filters');
const { isAllowlistedTarget, canonicalTargetSlug } = require('./recruiting-target-allowlist');

function floridaCampusVisitSetUp(player) {
  if (!player) return false;

  const ov = String(player.ufOvStatus || player.uf_ov_status || '').toLowerCase();
  if (ov && /cancel/.test(ov)) return false;
  // Soft bare "visit" from beat ingest is not proof of a campus trip set up.
  if (ov && /\b(scheduled|official|unofficial|completed)\b/.test(ov)) return true;

  if (player.visitStart || player.visitEnd) {
    const next = String(player.nextVisitSchool || player.visitSchool || 'Florida');
    if (!next || isFloridaSchool(next)) return true;
  }

  const trail = Array.isArray(player.visitTrail) ? player.visitTrail : [];
  if (trail.some((v) => isFloridaSchool(v?.school || 'Florida'))) return true;

  const visits = Array.isArray(player.visits) ? player.visits : [];
  if (visits.some((v) => isFloridaSchool(v?.school || 'Florida'))) return true;

  try {
    const on3Recruit = require('./on3-recruit-client');
    const teams = player.on3TopTeams || player.topTeams || [];
    const year = Number(player.classYear) || 2028;
    const uf = on3Recruit.getFloridaTeam(teams, year);
    if (uf) {
      if (Number(uf.officialVisitCount) > 0 || Number(uf.unOfficialVisitCount) > 0) return true;
      if (uf.latestVisit) return true;
    }
  } catch {
    /* optional */
  }

  return false;
}

/**
 * Hard gate: 2028 + campus visit set up → allowlist promote.
 * Offer alone does NOT promote (War Room path).
 */
function shouldPromoteOnCampusVisit(player, classYear) {
  const year = Number(classYear || player?.classYear);
  if (year === 2027) return false;
  if (year !== 2028) return false;
  if (!player?.name) return false;
  if (!floridaCampusVisitSetUp(player)) return false;
  // Prefer On3 identity; still allow when visit intel stamped a real slug.
  const slug = canonicalTargetSlug(player.slug || player.on3Slug || '');
  if (!slug && !player.on3Slug) return false;
  return true;
}

/**
 * Idempotent: add to admin allowlist (+ optional 2028 board seed / FC provision).
 */
async function promoteAllowlistOnCampusVisit({
  slug,
  name,
  classYear = 2028,
  player = null,
  dryRun = false,
  seedBoard = true,
  seedFutureCast = true,
} = {}) {
  const key = canonicalTargetSlug(slug || player?.slug || '');
  const displayName = String(name || player?.name || '').trim();
  const year = Number(classYear || player?.classYear) || 2028;
  if (!key || !displayName) {
    return { ok: false, reason: 'missing_slug_or_name', slug: key || null };
  }

  const probe = {
    ...(player || {}),
    slug: key,
    name: displayName,
    classYear: year,
    on3Slug: player?.on3Slug || key,
  };

  if (!shouldPromoteOnCampusVisit(probe, year)) {
    return { ok: true, promoted: false, reason: 'campus_visit_gate_not_met', slug: key };
  }

  if (isAllowlistedTarget({ slug: key, classYear: year }, year)) {
    return { ok: true, promoted: false, reason: 'already_allowlisted', slug: key, allowlisted: true };
  }

  if (dryRun) {
    return { ok: true, promoted: true, dryRun: true, slug: key, allowlisted: true };
  }

  const { addToAdminAllowlist } = require('./admin-allowlist-store');
  const allow = addToAdminAllowlist({ slug: key, name: displayName, classYear: year });
  const steps = [{ step: 'admin_allowlist', ...allow }];

  if (seedBoard && year === 2028) {
    try {
      const { upsert2028TargetBoardSeed } = require('./player-intel-entry');
      upsert2028TargetBoardSeed({
        ...(player || {}),
        slug: key,
        name: displayName,
        classYear: year,
        pos: player?.pos || player?.position || 'ATH',
        school: player?.school || '',
        state: player?.state || '',
      });
      steps.push({ step: '2028_target_board_seed', ok: true, slug: key });
    } catch (err) {
      steps.push({
        step: '2028_target_board_seed',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (seedFutureCast && year === 2028) {
    try {
      const { provisionAllowlistPredictionForSlug } = require('./allowlist-futurecast-provision');
      const fc = await provisionAllowlistPredictionForSlug(key, 2028);
      steps.push({ step: 'futurecast_prediction_seed', ...fc });
    } catch (err) {
      steps.push({
        step: 'futurecast_prediction_seed',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    promoted: Boolean(allow?.added !== false && !allow?.reason),
    allowlisted: true,
    slug: key,
    allow,
    steps,
  };
}

module.exports = {
  floridaCampusVisitSetUp,
  shouldPromoteOnCampusVisit,
  promoteAllowlistOnCampusVisit,
};
