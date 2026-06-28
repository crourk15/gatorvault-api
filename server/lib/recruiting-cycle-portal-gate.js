/**
 * Portal season gate for Render cron (plain Node — no TS loader).
 * Keep in sync with recruiting-cycle.ts shouldRunPortalIntelJob().
 */
function getPortalSeasonState(at = new Date()) {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth() + 1;
  const day = at.getUTCDate();

  if (month === 12 || (month === 1 && day <= 15)) {
    return { active: true };
  }
  if ((month === 4 && day >= 15) || (month === 5 && day <= 1)) {
    return { active: true };
  }
  return { active: false };
}

function shouldRunPortalIntelJob(at = new Date()) {
  return getPortalSeasonState(at).active;
}

module.exports = {
  shouldRunPortalIntelJob,
};