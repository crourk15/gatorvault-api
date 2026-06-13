/**
 * Verified recruiting targets only — no synthetic/seed/fallback players.
 * Allowed: On3, Rivals, 247 composite, verified UF offer lists, staff dashboard entries.
 */

const VERIFIED_OFFER_STATUSES = /offer|visit|scheduled|cancelled|committed/i;

function hasOn3Source(player) {
  return !!(
    player?.on3Id ||
    player?.on3_id ||
    player?.on3ProfileUrl ||
    player?.on3_profile_url ||
    String(player?.on3Source || player?.on3_source || '').toLowerCase() === 'on3'
  );
}

function hasRivalsSource(player) {
  return !!(
    player?.rivalsId ||
    player?.rivalsUserId ||
    player?.rivalsKey ||
    player?.rivalsLastPrediction ||
    player?.rivalsArticleUrl ||
    player?.rivalsAnalyst
  );
}

function hasComposite247Source(player) {
  return !!(
    player?.composite247Id ||
    player?.sports247Id ||
    player?.r247Id ||
    player?.composite247Rank != null ||
    String(player?.source || '').toLowerCase() === '247' ||
    String(player?.source || '').toLowerCase() === '247composite'
  );
}

function hasVerifiedUFOffer(player) {
  if (player?.ufOfferVerified || player?.hasUFOffer || player?.ufOffer) return true;
  const ov = String(player?.ufOvStatus || player?.uf_ov_status || '');
  return !!(ov && VERIFIED_OFFER_STATUSES.test(ov));
}

function hasStaffDashboardEntry(player) {
  return !!(
    player?.staffEntry ||
    player?.staffDashboard ||
    player?.ingressSource === 'staff-dashboard' ||
    String(player?.source || '').toLowerCase() === 'staff' ||
    (player?.vaultGrade != null && player?.vaultGradeUpdatedAt)
  );
}

function isVerifiedRecruitingTarget(player) {
  if (!player) return false;
  return (
    hasOn3Source(player) ||
    hasRivalsSource(player) ||
    hasComposite247Source(player) ||
    hasVerifiedUFOffer(player) ||
    hasStaffDashboardEntry(player)
  );
}

function filterVerifiedTargets(targets) {
  return (targets || []).filter(isVerifiedRecruitingTarget);
}

module.exports = {
  isVerifiedRecruitingTarget,
  filterVerifiedTargets,
  hasOn3Source,
  hasRivalsSource,
  hasComposite247Source,
  hasVerifiedUFOffer,
  hasStaffDashboardEntry,
};
