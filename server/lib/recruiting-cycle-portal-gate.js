/**
 * Portal season gate for Render cron (plain Node — no TS loader).
 * Keep in sync with recruiting-cycle.ts shouldRunPortalIntelJob().
 * NCAA FBS/FCS: 10-day window starting the first business day after Jan 1.
 * 2026-27 is Jan 4–13, 2027. No December or spring football window.
 */
function addUtcDays(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

function ymdUtc(d) {
  return d.toISOString().slice(0, 10);
}

function footballWinterWindow(januaryYear) {
  let start = new Date(Date.UTC(januaryYear, 0, 2));
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
    start = addUtcDays(start, 1);
  }
  return { startYmd: ymdUtc(start), endYmd: ymdUtc(addUtcDays(start, 9)) };
}

function getPortalSeasonState(at = new Date()) {
  const today = ymdUtc(at);
  const win = footballWinterWindow(at.getUTCFullYear());
  return { active: today >= win.startYmd && today <= win.endYmd };
}

function shouldRunPortalIntelJob(at = new Date()) {
  return getPortalSeasonState(at).active;
}

module.exports = {
  shouldRunPortalIntelJob,
  footballWinterWindow,
};
