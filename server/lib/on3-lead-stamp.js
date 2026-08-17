/**
 * Server-owned "On3 lead" stamp for chase cards.
 * Client should prefer `player.on3Lead` from the API so stamp bugs ship via Render,
 * not Codemagic — predictions change constantly; stamp *logic* stays on the API.
 */

function isUfGatorsSchool(name) {
  const t = String(name || '');
  if (
    /florida state|\bfsu\b|south florida|\busf\b|florida atlantic|\bfau\b|florida a\s*&\s*m|\bfamu\b/i.test(
      t
    )
  ) {
    return false;
  }
  return /\bflorida\b|\bgators\b|\buf\b/i.test(t);
}

function normalizeSchool(name) {
  return String(name || '')
    .replace(/\b(university|seminoles|bulldogs|crimson tide|longhorns)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keep in sync with client shortSchoolLabel — API is source of truth for the stamp. */
function shortSchoolLabel(name) {
  const n = normalizeSchool(name);
  if (/florida state|\bfsu\b/i.test(n)) return 'FSU';
  if (/south florida|\busf\b/i.test(n)) return 'USF';
  if (/florida atlantic|\bfau\b/i.test(n)) return 'FAU';
  if (isUfGatorsSchool(n)) return 'UF';
  if (/georgia tech|yellow jackets/i.test(n)) return 'GT';
  if (/georgia/i.test(n)) return 'UGA';
  if (/alabama/i.test(n)) return 'Bama';
  if (/texas tech|\bttu\b|red raiders/i.test(n)) return 'TTU';
  if (/texas a&m|tamu|aggies/i.test(n)) return 'TAMU';
  if (/texas(?! a&m)/i.test(n)) return 'Texas';
  if (/miami/i.test(n)) return 'Miami';
  if (/ohio state/i.test(n)) return 'OSU';
  if (/notre dame|fighting irish|\bnd\b/i.test(n)) return 'ND';
  if (/clemson/i.test(n)) return 'Clemson';
  if (/tennessee/i.test(n)) return 'Tenn';
  if (/lsu|louisiana state/i.test(n)) return 'LSU';
  if (/penn state/i.test(n)) return 'PSU';
  if (/kentucky/i.test(n)) return 'UK';
  if (/mississippi state|miss(?:issippi)?\s*st|\bmsst\b/i.test(n)) return 'Miss St';
  if (/ole miss|mississippi(?!\s*state)/i.test(n)) return 'Ole Miss';
  if (/south carolina|gamecocks/i.test(n)) return 'SC';
  if (/nc state|north carolina state|wolfpack/i.test(n)) return 'NC State';
  if (/north carolina|tar heels|\bunc\b/i.test(n)) return 'UNC';
  if (/michigan state|spartans/i.test(n)) return 'MSU';
  if (/michigan/i.test(n)) return 'Michigan';
  if (/oklahoma state/i.test(n)) return 'OKST';
  if (/oklahoma|sooners/i.test(n)) return 'OU';
  if (/stanford/i.test(n)) return 'Stanford';
  if (/rutgers/i.test(n)) return 'Rutgers';
  if (/purdue/i.test(n)) return 'Purdue';
  if (/nebraska/i.test(n)) return 'Nebraska';
  if (/missouri|mizzou/i.test(n)) return 'Missouri';
  if (/auburn/i.test(n)) return 'Auburn';
  if (/arkansas/i.test(n)) return 'Arkansas';
  if (/wisconsin/i.test(n)) return 'Wisconsin';
  if (/oregon state/i.test(n)) return 'ORST';
  if (/oregon/i.test(n)) return 'Oregon';
  if (/\busc\b|southern cal/i.test(n)) return 'USC';
  if (/ucla/i.test(n)) return 'UCLA';
  if (/pittsburgh|\bpitt\b/i.test(n)) return 'Pitt';
  if (/cincinnati/i.test(n)) return 'Cincy';
  if (/louisville/i.test(n)) return 'Louisville';
  if (/maryland/i.test(n)) return 'Maryland';
  if (/virginia tech|hokies/i.test(n)) return 'VT';
  if (/virginia(?!\s*tech)/i.test(n)) return 'UVA';
  if (/\bucf\b|central florida/i.test(n)) return 'UCF';
  if (/smu|southern methodist/i.test(n)) return 'SMU';
  if (/duke/i.test(n)) return 'Duke';
  if (/baylor/i.test(n)) return 'Baylor';
  if (/houston/i.test(n)) return 'Houston';
  if (/colorado/i.test(n)) return 'Colorado';
  if (/indiana/i.test(n)) return 'Indiana';
  if (/iowa state/i.test(n)) return 'Iowa St';
  if (/kansas state/i.test(n)) return 'K-State';
  if (/\biowa\b/i.test(n)) return 'Iowa';
  if (/vanderbilt|vandy/i.test(n)) return 'Vandy';
  if (/syracuse/i.test(n)) return 'Syracuse';
  if (/west virginia|wvu/i.test(n)) return 'WVU';
  if (/washington state/i.test(n)) return 'WSU';
  if (/washington/i.test(n)) return 'Washington';
  if (/arizona state/i.test(n)) return 'ASU';
  if (/arizona/i.test(n)) return 'Arizona';
  if (/illinois/i.test(n)) return 'Illinois';
  if (/northwestern/i.test(n)) return 'NW';
  if (/minnesota/i.test(n)) return 'Minnesota';
  if (/boston college|\bbc\b/i.test(n)) return 'BC';
  if (/memphis/i.test(n)) return 'Memphis';
  const words = n.split(' ').filter(Boolean);
  return words[0]?.slice(0, 10) || n.slice(0, 10) || '—';
}

function topThreat(player) {
  if (player?.committedTo && isUfGatorsSchool(player.committedTo)) return null;
  let peers = (player?.competingSchools || [])
    .filter((s) => s?.name && Number(s.pct) > 0 && !isUfGatorsSchool(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct));
  const mid = peers.find((s) => {
    const pct = Number(s.pct);
    return pct >= 15 && pct <= 90;
  });
  // Keep real ~95% favorites; only drop Asher-style ~99–100 fake locks.
  if (mid && Number(peers[0]?.pct) >= 99) {
    peers = peers.filter((s) => Number(s.pct) < 99);
  }
  const top = peers[0];
  if (!top) return null;
  const pct = Math.round(Number(top.pct));
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return { name: String(top.name).trim(), label: shortSchoolLabel(top.name), pct };
}

/**
 * Resolve the chase-card "On3 lead" stamp string from a healed HP/board row.
 * @returns {string} e.g. "UF", "ND", "Miami", "—"
 */
function resolveOn3LeadStamp(player) {
  if (!player || typeof player !== 'object') return '—';
  const threat = topThreat(player);
  const ufRpm =
    player.ufRpmPct != null && Number(player.ufRpmPct) > 0
      ? Math.round(Number(player.ufRpmPct))
      : null;
  if (threat && (ufRpm == null || threat.pct >= ufRpm)) {
    return threat.label || shortSchoolLabel(threat.name);
  }
  if (ufRpm != null && ufRpm > 0) return 'UF';
  if (threat) return threat.label || shortSchoolLabel(threat.name);
  return '—';
}

/** Stamp `on3Lead` onto a player row (mutates copy). */
function withOn3LeadStamp(row) {
  if (!row || typeof row !== 'object') return row;
  const on3Lead = resolveOn3LeadStamp(row);
  if (row.on3Lead === on3Lead) return row;
  return { ...row, on3Lead };
}

module.exports = {
  isUfGatorsSchool,
  shortSchoolLabel,
  resolveOn3LeadStamp,
  withOn3LeadStamp,
};
