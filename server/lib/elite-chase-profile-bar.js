/**
 * Charles elite profile bar for Priority Chase cards.
 * Half-done soft shells (no stars / no school / no Vault Scouting) stay off the board
 * until identity + War Room comp/projection/strengths are on file.
 */
'use strict';

function hasRealSchool(school) {
  const s = String(school || '').trim();
  if (!s || s === '—' || s === '-') return false;
  return !/^(tbd|unknown|n\/a|high school tbd)$/i.test(s);
}

function hasVaultScouting(slug) {
  try {
    const wr = require('./war-room-store');
    const bd = wr.getBreakdownBySlug?.(slug);
    if (!bd) return false;
    try {
      const { isProvisionalVaultCard } = require('./recruiting-intel-quality');
      if (isProvisionalVaultCard(bd)) return false;
    } catch {
      /* optional */
    }
    if (bd.filmWatched === false || bd.provisional === true) return false;
    const comp = String(bd.comparison || bd.playerComp || '').trim();
    const proj = String(bd.projection || '').trim();
    const strengths = Array.isArray(bd.strengths) ? bd.strengths : [];
    return comp.length >= 8 && proj.length >= 8 && strengths.length >= 2;
  } catch {
    return false;
  }
}

/**
 * @param {object} player HP / board row
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function explainEliteChaseProfile(player) {
  const reasons = [];
  if (!player || typeof player !== 'object') return { ok: false, reasons: ['missing'] };
  const slug = String(player.slug || player.id || '').toLowerCase();
  const stars = Number(player.stars);
  if (!(Number.isFinite(stars) && stars >= 1)) reasons.push('no_stars');
  if (!hasRealSchool(player.school || player.highSchool)) reasons.push('no_school');
  const fit = Number(player.fitScore ?? player.schemeFit ?? player.fit);
  if (!(Number.isFinite(fit) && fit > 0)) reasons.push('no_fit');
  if (!slug || !hasVaultScouting(slug)) reasons.push('no_vault_scouting');
  return { ok: reasons.length === 0, reasons };
}

function meetsEliteChaseProfile(player) {
  return explainEliteChaseProfile(player).ok;
}

function filterEliteChaseProfiles(list) {
  return (list || []).filter((p) => meetsEliteChaseProfile(p));
}

module.exports = {
  hasRealSchool,
  hasVaultScouting,
  explainEliteChaseProfile,
  meetsEliteChaseProfile,
  filterEliteChaseProfiles,
};
