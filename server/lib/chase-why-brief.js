'use strict';

/**
 * Why we chase — multi-factor insider nuggets for Priority Chase.
 * Prefer live override (Admin / upsert); else compose from chase factors.
 *
 * Voice (Charles bar):
 *  - Weave need + staff + geo + rival + visit when true
 *  - Name rivals (FSU/UGA/Miami) — not vague "live fight"
 *  - Talent identity when it earns it (5★, national rank)
 *  - Honest board state without soft crutches ("filler", "mid-board noise")
 *  - No score dumps, no hometown lead
 */

const { getOverride } = require('./chase-why-store');

function lastName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(p));
  return parts.length ? parts[parts.length - 1] : 'Him';
}

function posKey(pos) {
  return String(pos || '').trim().toUpperCase();
}

function posLabel(pos) {
  const p = posKey(pos);
  if (p === 'EDGE' || p === 'DE' || p === 'OLB') return 'EDGE';
  if (p === 'DT' || p === 'DL' || p === 'NT') return 'DL';
  if (p === 'CB') return 'CB';
  if (p === 'S' || p === 'SAF') return 'S';
  if (p === 'WR') return 'WR';
  if (p === 'RB') return 'RB';
  if (p === 'QB') return 'QB';
  if (p === 'OT' || p === 'OL' || p === 'IOL' || p === 'OG' || p === 'OC' || p === 'C') return 'OL';
  if (p === 'TE') return 'TE';
  if (p === 'LB' || p === 'ILB' || p === 'MLB') return 'LB';
  if (p === 'ATH') return 'ATH';
  return p || 'prospect';
}

function shortSchool(name) {
  const n = String(name || '').trim();
  if (!n || n === '-' || n === '\u2014') return '';
  if (/florida state|\bfsu\b/i.test(n)) return 'FSU';
  if (/georgia tech|\bgt\b/i.test(n)) return 'GT';
  if (/georgia|\buga\b/i.test(n)) return 'Georgia';
  if (/miami|\bhurricanes\b/i.test(n)) return 'Miami';
  if (/alabama|\bbama\b/i.test(n)) return 'Alabama';
  if (/clemson/i.test(n)) return 'Clemson';
  if (/ohio state|\bosu\b/i.test(n)) return 'Ohio State';
  if (/penn state|\bpsu\b/i.test(n)) return 'Penn State';
  if (/notre dame|\bnd\b/i.test(n)) return 'Notre Dame';
  if (/ole miss|mississippi(?!\s*state)/i.test(n)) return 'Ole Miss';
  if (/mississippi state|\bmiss\.?\s*st/i.test(n)) return 'Miss State';
  if (/lsu|louisiana state/i.test(n)) return 'LSU';
  if (/tennessee(?!\s*tech)/i.test(n)) return 'Tennessee';
  if (/texas a&m|\btamu\b/i.test(n)) return 'Texas A&M';
  if (/\btexas\b/i.test(n)) return 'Texas';
  if (/auburn/i.test(n)) return 'Auburn';
  if (/south carolina/i.test(n)) return 'South Carolina';
  if (/nc state|north carolina state/i.test(n)) return 'NC State';
  if (/north carolina|\bunc\b/i.test(n)) return 'UNC';
  if (/michigan(?!\s*state)/i.test(n)) return 'Michigan';
  if (/oregon/i.test(n)) return 'Oregon';
  if (/oklahoma/i.test(n)) return 'Oklahoma';
  if (/florida atlantic|\bfau\b/i.test(n)) return 'FAU';
  if (/\bflorida\b|\bgators\b|^uf$/i.test(n)) return 'UF';
  return n.split(/\s+/).slice(0, 2).join(' ');
}

function isTrench(pos) {
  const p = posKey(pos);
  return p === 'EDGE' || p === 'DE' || p === 'OLB' || p === 'DT' || p === 'DL' || p === 'NT';
}

function isCb(pos) {
  return posKey(pos) === 'CB';
}

function isEdge(pos) {
  const p = posKey(pos);
  return p === 'EDGE' || p === 'DE' || p === 'OLB';
}

function isInteriorOl(pos) {
  const p = posKey(pos);
  return p === 'IOL' || p === 'OG' || p === 'OC' || p === 'C' || p === 'OL';
}

function laneNums(player) {
  const lanes = player?.hotLanes && typeof player.hotLanes === 'object' ? player.hotLanes : {};
  const fitScore = Number(player?.fitScore);
  return {
    staff: Number(player?.staffScore ?? lanes.staffHeat),
    fit: Number(
      player?.mustGetFitScore ?? lanes.mustGetFit ?? (Number.isFinite(fitScore) ? fitScore : NaN)
    ),
    need: Number(player?.positionalNeedScore ?? lanes.positionalNeed),
    market: Number(player?.marketScore ?? lanes.marketPressure),
    geo: Number(player?.geoScore ?? lanes.geoPipeline),
  };
}

function isUfSchoolName(name) {
  const t = String(name || '');
  // Never treat FSU / USF / FAU / FAMU as Florida.
  if (/florida state|\bfsu\b|south florida|\busf\b|florida atlantic|\bfau\b|florida a\s*&\s*m|\bfamu\b/i.test(t)) {
    return false;
  }
  return /\bflorida\b|\bgators\b|^uf$/i.test(t);
}

function boardLeadPeers(player) {
  const peers = Array.isArray(player?.competingSchools) ? player.competingSchools : [];
  return peers
    .filter((s) => s?.name && Number(s.pct) > 0 && !isUfSchoolName(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct));
}

function on3LeadName(player) {
  const stamped = String(player?.on3Lead || player?.on3LeadSchool || player?.crystalBallSchool || '').trim();
  if (stamped && stamped !== '-' && stamped !== '\u2014' && !/florida|^uf$/i.test(stamped)) {
    return shortSchool(stamped);
  }
  const top = boardLeadPeers(player)[0];
  return top ? shortSchool(top.name) : '';
}

function rivalPair(player) {
  const peers = boardLeadPeers(player).slice(0, 2).map((p) => shortSchool(p.name)).filter(Boolean);
  const uniq = [...new Set(peers)];
  if (uniq.length >= 2) return `${uniq[0]}/${uniq[1]}`;
  return uniq[0] || '';
}

function isInState(player) {
  if (player?.hotBadges?.inState === true || player?.inState === true) return true;
  const st = String(player?.state || player?.hometownState || '').toUpperCase();
  if (st === 'FL' || st === 'FLORIDA') return true;
  return /\bFL\b|\(FL\)|,\s*FL\b|Florida/i.test(String(player?.school || ''));
}

function visitChip(player) {
  const labels = Array.isArray(player?.visitLabels)
    ? player.visitLabels
    : Array.isArray(player?.visitHistory)
      ? player.visitHistory.map((v) => String(v?.label || v?.type || '').trim()).filter(Boolean)
      : [];
  const raw = String(labels[0] || '').trim();
  if (!raw) return '';
  // "Expected FAU visit · Sep 5" / "Expected Ole Miss visit · Sep 26"
  const m = raw.match(/Expected\s+(.+?)\s+visit/i);
  if (m) {
    const school = shortSchool(m[1]) || m[1].trim();
    if (/game\s*day|gameday/i.test(raw)) return `the ${school} game-day visit keeps the process live`;
    return `the ${school} visit keeps the process live`;
  }
  if (/FAU|Ole Miss|Miami|FSU|UGA|Georgia/i.test(raw) && /visit/i.test(raw)) {
    return `${raw.replace(/\s*·\s*.*$/, '').trim()} keeps the process live`;
  }
  return '';
}

function starBand(stars) {
  const n = Number(stars);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 5) return 'Five-star';
  if (n >= 4) return 'Four-star';
  if (n >= 3) return 'Three-star';
  return null;
}

function talentLead(player, pos) {
  const stars = starBand(player?.stars);
  const nat = Number(player?.nationalRank ?? player?.natlRank);
  // Five-star identity wins — Charles Asher sample leads with "Five-star EDGE"
  if (stars === 'Five-star') return `${stars} ${pos}`;
  if (Number.isFinite(nat) && nat > 0 && nat <= 100) {
    return `Nationally ranked ${pos}`;
  }
  if (stars) return `${stars} ${pos}`;
  return null;
}

function roomGapPhrase(pos, needHot) {
  if (!needHot) return '';
  if (isEdge(pos)) return `Florida\u2019s EDGE room is a real gap`;
  if (isTrench(pos)) return `Florida\u2019s DL room is a real gap`;
  if (isCb(pos)) return `Florida\u2019s secondary needs another lockdown piece`;
  const p = posLabel(pos);
  if (p === 'LB') return `Florida\u2019s LB room still needs a piece`;
  if (p === 'OL') return `Florida\u2019s OL room still needs a piece`;
  if (p === 'S') return `Florida\u2019s safety room still needs a piece`;
  return '';
}

function rolePriorityPhrase(pos, inState, staffStrong) {
  if (!staffStrong && !inState) return '';
  if (isEdge(pos) && inState) return 'the in-state pass-rush priority they\u2019re pressing';
  if (isEdge(pos)) return 'the pass-rush priority they\u2019re pressing';
  if (isCb(pos) && inState) return 'the in-state CB priority they\u2019re pressing';
  if (isCb(pos)) return 'the CB priority they\u2019re pressing';
  if (posLabel(pos) === 'LB' && inState) return 'the in-state LB priority they\u2019re pressing';
  if (inState) return `the in-state ${posLabel(pos)} priority they\u2019re pressing`;
  if (staffStrong) return `a real ${posLabel(pos)} priority on staff\u2019s board`;
  return '';
}

function collectBuiltFrom(flags) {
  return flags.filter(Boolean);
}

/**
 * @returns {{ text: string, builtFrom: string[] }}
 */
function composeWhyWeChase(player, opts = {}) {
  const rank = Math.max(1, Number(opts.chaseRank) || 1);
  const ln = lastName(player?.name);
  const pos = posLabel(player?.position);
  const rawPos = player?.position;
  const { staff, fit, need, market } = laneNums(player);
  const lead = on3LeadName(player);
  const rivals = rivalPair(player);
  const ufPct = Number(player?.ufRpmPct);
  const leadPct = Number(boardLeadPeers(player)[0]?.pct);
  const inState = isInState(player);
  const visit = visitChip(player);
  const quiet = Boolean(player?.hotBadges?.quietChase);
  const staffOn = Boolean(player?.hotBadges?.staffAssigned) || (Number.isFinite(staff) && staff >= 55);

  const staffLock = Number.isFinite(staff) && staff >= 78;
  const staffStrong = staffLock || staffOn || (Number.isFinite(staff) && staff >= 62);
  const fitElite = Number.isFinite(fit) && fit >= 88;
  const fitStrong = Number.isFinite(fit) && fit >= 78;
  const needHot = Number.isFinite(need) && need >= 85 && Boolean(roomGapPhrase(rawPos, true));
  const ufOwns = Number.isFinite(ufPct) && ufPct >= 55;
  const ufLow = Number.isFinite(ufPct) && ufPct > 0 && ufPct < 30;
  const ufMid = Number.isFinite(ufPct) && ufPct >= 30 && ufPct < 55;
  const rivalFight =
    Boolean(lead) &&
    lead !== 'UF' &&
    ((Number.isFinite(ufPct) && ufPct < 55) || !Number.isFinite(ufPct));

  const factors = [];
  if (needHot) factors.push(isEdge(rawPos) ? 'EDGE need' : isCb(rawPos) ? 'CB need' : `${pos} need`);
  if (inState) factors.push('in-state');
  if (staffStrong) factors.push(quiet ? 'quiet staff push' : 'staff heat');
  if (fitElite || fitStrong) factors.push('Fit');
  if (starBand(player?.stars) === 'Five-star') factors.push('5\u2605');
  else if (Number(player?.nationalRank ?? player?.natlRank) > 0 && Number(player?.nationalRank ?? player?.natlRank) <= 100) {
    factors.push(`#${Math.round(Number(player.nationalRank ?? player.natlRank))} nat`);
  }
  if (ufOwns) factors.push('UF board lead');
  else if (ufLow) factors.push('low UF %');
  else if (ufMid) factors.push('mid UF %');
  if (rivalFight && lead) factors.push(`${lead} lead`);
  else if (rivalFight) factors.push('rival fight');
  if (visit) factors.push('expected visit');

  const room = roomGapPhrase(rawPos, needHot);
  const role = rolePriorityPhrase(rawPos, inState, staffStrong);
  const talent = talentLead(player, pos);
  const topOfBoard = rank <= 3;
  const midBoard = rank >= 4 && rank <= 10;

  let text = '';

  const who = rivals || lead;
  const fiveStarFit = talent && fitElite && /Five-star/i.test(String(talent));

  // Shared multi-factor templates (Charles bar)
  const nuggetRoomRoleRival =
    room && role && rivalFight
      ? `${room} and ${ln} is ${role} \u2014 even with the board still wide open${who ? ` and ${who} in it` : ''}.`
      : '';
  const nuggetFiveStarChase =
    talent && fitElite && rivalFight && lead
      ? `${talent} with elite scheme fit \u2014 Florida has to stay in this chase even while ${lead} leads${visit ? `, and ${visit}` : ''}.`
      : '';
  const nuggetStaffTop10 =
    talent && staffStrong && (needHot || room)
      ? `${talent} with staff already assigned \u2014 not a Florida lock, but the room need + ${quiet ? 'quiet staff push' : 'staff push'} is why he\u2019s still a top-${Math.min(10, Math.max(rank, 5))} chase.`
      : '';
  const nuggetLateFitRival =
    fitStrong && rivalFight && lead
      ? isInteriorOl(rawPos) || (isTrench(rawPos) && !isEdge(rawPos))
        ? `Interior line with real trench value and a board that\u2019s moving \u2014 not a top-target yet, but Fit keeps him on the chase while ${lead} sits ahead.`
        : talent
          ? `${talent} \u2014 not a top-target yet, but Fit keeps him on the chase while ${lead} sits ahead.`
          : `Not a top-target yet, but Fit keeps ${ln} on the chase while ${lead} sits ahead.`
      : '';

  // --- Top of chase (#1-3) ---
  if (topOfBoard) {
    if (ufOwns && staffStrong) {
      text = `Florida already owns this ${pos} on the board \u2014 staff is locked on ${ln}, and that\u2019s why he\u2019s sitting at the top of the chase.`;
    } else if (fiveStarFit && nuggetFiveStarChase) {
      text = nuggetFiveStarChase;
    } else if (nuggetRoomRoleRival) {
      text = nuggetRoomRoleRival;
    } else if (nuggetFiveStarChase) {
      text = nuggetFiveStarChase;
    } else if (talent && fitElite) {
      text = `${talent} with elite scheme fit \u2014 Florida has him where a true must-get belongs${visit ? `, and ${visit}` : ''}.`;
    } else if (room && staffStrong) {
      text = `${room} and staff is all-in on ${ln} as the ${pos} fix${rivalFight && lead ? ` even while ${lead} leads` : ''}.`;
    } else if (staffStrong && rivalFight && lead) {
      text = `Staff has ${ln} marked as a real ${pos} priority \u2014 Florida\u2019s pressing even while ${lead} leads.`;
    } else if (staffStrong) {
      text = `Staff has ${ln} marked as a real ${pos} priority \u2014 that\u2019s why he\u2019s this high on our chase.`;
    } else if (ufOwns) {
      text = `Florida\u2019s already ahead on ${ln} \u2014 that\u2019s why he\u2019s this high on the chase.`;
    } else {
      text = `${ln}\u2019s this high because Florida\u2019s ranking him as a true ${pos} priority on this board.`;
    }
  } else if (midBoard) {
    // Prefer staff+need top-10 honesty when nationally ranked / staffed (Alexander)
    if (nuggetStaffTop10 && Number(player?.nationalRank ?? player?.natlRank) > 0 && Number(player?.nationalRank ?? player?.natlRank) <= 150) {
      text = nuggetStaffTop10;
    } else if (fiveStarFit && nuggetFiveStarChase) {
      text = nuggetFiveStarChase;
    } else if (nuggetRoomRoleRival) {
      text = nuggetRoomRoleRival;
    } else if (nuggetFiveStarChase) {
      text = nuggetFiveStarChase;
    } else if (nuggetStaffTop10) {
      text = nuggetStaffTop10;
    } else if (room && rivalFight && lead) {
      text = `${room} \u2014 Florida\u2019s still chasing ${ln} as a ${pos} answer while ${lead} leads.`;
    } else if (fitStrong && rivalFight && lead) {
      text = `${ln}\u2019s still a live ${pos} chase \u2014 Fit keeps him here even while ${lead} sits ahead${visit ? `, and ${visit}` : ''}.`;
    } else if (staffStrong && rivalFight && lead) {
      text = `There\u2019s a real fight for ${ln} right now \u2014 Florida\u2019s staff is still in it against ${lead}.`;
    } else if (room) {
      text = `${room} \u2014 Florida\u2019s still chasing ${ln} as a ${pos} answer in this class.`;
    } else if (staffStrong) {
      text = `${ln}\u2019s this high because staff is still treating him like a real ${pos} chase.`;
    } else {
      text = `${ln}\u2019s this high because Florida\u2019s still ranking him as a live ${pos} target on this board.`;
    }
  } else {
    // Late board — still multi-factor when the intel is there (Henderson / Evans)
    if (nuggetRoomRoleRival) {
      text = nuggetRoomRoleRival;
    } else if (nuggetLateFitRival) {
      text = nuggetLateFitRival;
    } else if (nuggetFiveStarChase) {
      text = nuggetFiveStarChase;
    } else if (talent && staffStrong && needHot) {
      text = `${talent} with staff already assigned \u2014 room need + staff push is why he stays on the chase.`;
    } else if (rivalFight && lead && staffStrong) {
      text = `There\u2019s still a live fight for ${ln} \u2014 Florida\u2019s staff hasn\u2019t backed off against ${lead}.`;
    } else if (rivalFight && lead) {
      text = `${ln} stays on the board because the ${pos} fight with ${lead} is still live.`;
    } else if (room) {
      text = `${room} \u2014 Florida still needs ${ln} as a ${pos} piece.`;
    } else if (staffStrong) {
      text = `Staff\u2019s still on ${ln} \u2014 that\u2019s why this ${pos} stays on our chase.`;
    } else if (visit) {
      text = `${ln} stays on the chase as a live ${pos} name \u2014 ${visit}.`;
    } else {
      text = `${ln} stays on the chase as a live ${pos} name Florida still wants in this class.`;
    }
  }

  // Clean doubled room phrasing accidents
  text = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\bsecondary needs another lockdown piece and Florida/i, 'secondary needs another lockdown piece \u2014 Florida')
    .trim();

  return { text, builtFrom: collectBuiltFrom(factors) };
}

function generateWhyWeChase(player, opts = {}) {
  return composeWhyWeChase(player, opts).text;
}

function resolveWhyWeChase(player, opts = {}) {
  const slug = String(player?.slug || '').trim().toLowerCase();
  const override = getOverride(slug);
  if (override) {
    const composed = composeWhyWeChase(player, opts);
    return { text: String(override).trim(), builtFrom: composed.builtFrom, overridden: true };
  }
  const composed = composeWhyWeChase(player, opts);
  return { text: composed.text, builtFrom: composed.builtFrom, overridden: false };
}

function attachWhyWeChaseToPlayers(players) {
  if (!Array.isArray(players)) return players;
  const indexed = players.map((p, i) => ({
    i,
    score: Number(p?.priorityScore) || 0,
  }));
  const ranked = [...indexed].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.i - b.i;
  });
  const rankByIndex = new Map();
  ranked.forEach((row, ri) => rankByIndex.set(row.i, ri + 1));

  return players.map((p, i) => {
    if (!p || typeof p !== 'object') return p;
    const chaseRank = rankByIndex.get(i) || i + 1;
    const resolved = resolveWhyWeChase(p, { chaseRank });
    const builtFrom = Array.isArray(resolved.builtFrom) ? resolved.builtFrom : [];
    return {
      ...p,
      whyWeChase: resolved.text,
      whyWeChaseBuiltFrom: builtFrom.length ? builtFrom.join(' \u00b7 ') : null,
      chaseRank,
    };
  });
}

module.exports = {
  generateWhyWeChase,
  composeWhyWeChase,
  resolveWhyWeChase,
  attachWhyWeChaseToPlayers,
  lastName,
  posLabel,
  shortSchool,
};
