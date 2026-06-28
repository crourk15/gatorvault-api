'use strict';

const { isPlaceholderSchool, isPlaceholderSkinny } = require('./recruiting-placeholder-school');

function hasRealSchool(school) {
  return Boolean(school) && !isPlaceholderSchool(school);
}

function hasMeaningfulOn3Fields(on3, identity) {
  if (!on3 || !on3.on3Id) return false;
  const hasRating =
    Number(on3.stars) > 0 ||
    (on3.rating != null && Number.isFinite(Number(on3.rating)) && Number(on3.rating) > 0);
  const hasMeasure = Boolean(on3.htWt || on3.pos);
  const hasSchool =
    hasRealSchool(on3.school) ||
    hasRealSchool(identity?.highSchool) ||
    hasRealSchool(identity?.school);
  return hasRating || hasMeasure || hasSchool;
}

function assessOn3Intel(resolved) {
  const on3 = resolved?.on3 || {};
  const identity = resolved?.identity || {};
  const recruitSlug = resolved?.recruitSlug || null;

  if (!recruitSlug) {
    return {
      ok: false,
      on3Verified: false,
      reason: 'no_on3_slug',
      message: 'On3 profile not found. Real On3 intel is required before saving.',
    };
  }

  if (!on3.on3Id) {
    return {
      ok: false,
      on3Verified: false,
      reason: 'no_on3_id',
      message: 'On3 player ID missing. Cannot enter intel without a verified On3 profile match.',
    };
  }

  if (!hasMeaningfulOn3Fields(on3, identity)) {
    return {
      ok: false,
      on3Verified: false,
      reason: 'thin_on3_profile',
      message:
        'On3 profile lacks verifiable ratings, measurables, or school data. Refresh On3 match or enter via beat-writer ingest.',
    };
  }

  return {
    ok: true,
    on3Verified: true,
    reason: 'verified',
    message: 'On3 profile verified.',
    on3ProfileUrl: on3.on3ProfileUrl || null,
    on3Id: on3.on3Id,
    recruitSlug,
  };
}

module.exports = {
  isPlaceholderSkinny,
  hasRealSchool,
  hasMeaningfulOn3Fields,
  assessOn3Intel,
};