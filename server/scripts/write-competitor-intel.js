const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../lib/x-autoposter-competitor-intel.js');

const content = `/**
 * On3-verified competitor intel for autoposter copy — no beat-text school guessing.
 */
const on3Recruit = require('./on3-recruit-client');

const RPM_CLOSE_GAP = parseFloat(process.env.X_AUTOPOST_RPM_CLOSE_GAP || '8', 10);
const UF_MATCH = /florida|gators|\\buf\\b/i;

function teamNameFromOn3(team) {
  return String(team?.name || team?.fullName || team?.abbreviation || '').trim();
}

function competitorsFromPlayer(player, limit = 4) {
  const list = Array.isArray(player?.competitors) ? player.competitors : [];
  return list
    .map((c) => ({
      school: String(c?.school || c?.schoolName || c?.name || '').trim(),
      pct: c?.score != null ? Number(c.score) : c?.pct != null ? Number(c.pct) : null
    }))
    .filter((c) => c.school && !UF_MATCH.test(c.school))
    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))
    .slice(0, limit);
}

function competitorsFromOn3TopTeams(topTeams, classYear, limit = 4) {
  try {
    const hydrate = require('../lib/on3-board-hydrate');
    return hydrate
      .interestedSchoolsFromTopTeams(topTeams, classYear, limit + 4)
      .filter((s) => s.school && !UF_MATCH.test(s.school) && s.pct != null)
      .slice(0, limit)
      .map((s) => ({ school: s.school, pct: s.pct }));
  } catch {
    return on3Recruit
      .getYearTopTeams(topTeams || [], classYear)
      .filter((t) => !on3Recruit.isHighSchoolOrg(t) && !on3Recruit.isFloridaTeam(t))
      .map((t) => ({
        school: teamNameFromOn3(t.team),
        pct: t.prediction != null && Number(t.prediction) > 1 ? Number(t.prediction) : null
      }))
      .filter((c) => c.school && c.pct != null)
      .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))
      .slice(0, limit);
  }
}

function ufPctFromPlayer(player, predictions = []) {
  if (player?.ufProbability != null && Number(player.ufProbability) > 0) {
    return Number(player.ufProbability);
  }
  if (player?.ufRpmPct != null && Number(player.ufRpmPct) > 0) {
    return Number(player.ufRpmPct);
  }
  for (const p of predictions) {
    const v = p?.confidencePct ?? p?.ufRpmPct;
    if (v != null && Number(v) > 0) return Number(v);
  }
  return null;
}

function ufPctFromOn3TopTeams(topTeams, classYear) {
  try {
    const hydrate = require('../lib/on3-board-hydrate');
    return hydrate.ufRpmFromTopTeams(topTeams, classYear);
  } catch {
    const uf = on3Recruit.getFloridaTeam(topTeams || [], classYear);
    if (!uf) return null;
    const v = uf.prediction != null ? Number(uf.prediction) : uf.percent != null ? Number(uf.percent) : null;
    if (v == null || !Number.isFinite(v)) return null;
    return v > 1 ? v : v * 100;
  }
}

function resolveBoard(research = {}) {
  const player = research.player || {};
  const classYear = player.classYear || research.intel?.classYear || 2027;
  let competitors = competitorsFromPlayer(player);
  if (!competitors.length && research.on3TopTeams?.length) {
    competitors = competitorsFromOn3TopTeams(research.on3TopTeams, classYear);
  }
  let ufPct = ufPctFromPlayer(player, research.predictions);
  if ((ufPct == null || ufPct <= 0) && research.on3TopTeams?.length) {
    ufPct = ufPctFromOn3TopTeams(research.on3TopTeams, classYear);
  }
  return { competitors, ufPct, classYear };
}

function buildRpmAwareCompLine(research, { fallback = null } = {}) {
  const { competitors, ufPct } = resolveBoard(research);
  const leader = competitors[0];
  const second = competitors[1];
  const leaderPct = leader?.pct != null ? Math.round(leader.pct) : null;
  const secondPct = second?.pct != null ? Math.round(second.pct) : null;
  const ufRounded = ufPct != null ? Math.round(ufPct) : null;

  if (leader && ufRounded != null && leaderPct != null) {
    if (ufRounded >= leaderPct - RPM_CLOSE_GAP) {
      return second?.school
        ? \`\${second.school} is in, but Gainesville has the inside track.\`
        : 'Florida sits in the lead group on the board.';
    }
    if (second?.school && secondPct != null && ufRounded >= secondPct - RPM_CLOSE_GAP) {
      return \`\${leader.school} leads On3 at \${leaderPct}% — UF second at \${ufRounded}%.\`;
    }
    return \`\${leader.school} leads On3 at \${leaderPct}% — UF at \${ufRounded}% and pushing.\`;
  }

  if (leader && second) {
    return \`\${leader.school} and \${second.school} top On3 — UF is active in the mix.\`;
  }
  if (leader) {
    return \`\${leader.school} leads On3 — UF staff is still pushing for movement.\`;
  }

  return fallback || 'Staff contact has picked up as UF narrows the board.';
}

function verifiedSchoolNames(research, limit = 4) {
  return resolveBoard(research).competitors.map((c) => c.school).slice(0, limit);
}

module.exports = {
  RPM_CLOSE_GAP,
  competitorsFromPlayer,
  competitorsFromOn3TopTeams,
  resolveBoard,
  buildRpmAwareCompLine,
  verifiedSchoolNames,
  ufPctFromOn3TopTeams
};
`;

fs.writeFileSync(target, content, 'utf8');
console.log('wrote', target);
