'use strict';

/**
 * Why we chase — rank-truth prose for Priority Chase cards.
 * Prefer live override (Admin / upsert script); else generate from chase factors.
 * Editable anytime via API — no Codemagic for copy changes after client reads whyWeChase.
 *
 * Voice: confident insider nugget. No score dumps. No hometown lead.
 * No hedge tags or soft dismissals.
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

function posLabel(pos) {
  const p = String(pos || '').toUpperCase();
  if (p === 'EDGE' || p === 'DE' || p === 'OLB') return 'edge';
  if (p === 'DT' || p === 'DL' || p === 'NT') return 'DL';
  if (p === 'CB') return 'CB';
  if (p === 'S' || p === 'SAF') return 'safety';
  if (p === 'WR') return 'WR';
  if (p === 'RB') return 'RB';
  if (p === 'QB') return 'QB';
  if (p === 'OT' || p === 'OL' || p === 'IOL' || p === 'OG' || p === 'OC') return 'OL';
  if (p === 'TE') return 'TE';
  if (p === 'LB' || p === 'ILB' || p === 'MLB') return 'LB';
  if (p === 'ATH') return 'athlete';
  return p || 'prospect';
}

function isTrench(pos) {
  const p = String(pos || '').toUpperCase();
  return p === 'EDGE' || p === 'DE' || p === 'OLB' || p === 'DT' || p === 'DL' || p === 'NT';
}

function isCb(pos) {
  return String(pos || '').toUpperCase() === 'CB';
}

function needGapLine(need, pos) {
  if (!(need >= 85)) return '';
  if (isTrench(pos)) return 'the trench room is thin';
  if (isCb(pos)) return 'the secondary needs another lockdown piece';
  return '';
}

function laneNums(player) {
  const lanes = player?.hotLanes && typeof player.hotLanes === 'object' ? player.hotLanes : {};
  const fitScore = Number(player?.fitScore);
  return {
    staff: Number(player?.staffScore ?? lanes.staffHeat),
    fit: Number(player?.mustGetFitScore ?? lanes.mustGetFit ?? (Number.isFinite(fitScore) ? fitScore : NaN)),
    need: Number(player?.positionalNeedScore ?? lanes.positionalNeed),
    market: Number(player?.marketScore ?? lanes.marketPressure),
  };
}

function boardLeadPct(player) {
  const peers = Array.isArray(player?.competingSchools) ? player.competingSchools : [];
  const top = peers
    .filter((s) => s?.name && Number(s.pct) > 0 && !/florida|^uf$|gators/i.test(String(s.name)))
    .sort((a, b) => Number(b.pct) - Number(a.pct))[0];
  return top ? Number(top.pct) : Number(player?.leadRpmPct);
}

function on3LeadName(player) {
  const stamped = String(player?.on3Lead || player?.on3LeadSchool || player?.crystalBallSchool || '').trim();
  if (stamped && stamped !== '-' && stamped !== '\u2014') return stamped;
  const peers = Array.isArray(player?.competingSchools) ? player.competingSchools : [];
  const top = peers
    .filter((s) => s?.name && Number(s.pct) > 0 && !/florida|^uf$|gators/i.test(String(s.name)))
    .sort((a, b) => Number(b.pct) - Number(a.pct))[0];
  return top ? String(top.name) : '';
}

/**
 * Insider nugget — why THIS name sits THIS high on OUR board.
 */
function generateWhyWeChase(player, opts = {}) {
  const rank = Math.max(1, Number(opts.chaseRank) || 1);
  const ln = lastName(player?.name);
  const pos = posLabel(player?.position);
  const { staff, fit, need, market } = laneNums(player);
  const lead = on3LeadName(player);
  const ufPct = Number(player?.ufRpmPct);
  const leadPct = boardLeadPct(player);
  const gapLine = needGapLine(need, player?.position);

  const topOfBoard = rank <= 3;
  const midBoard = rank >= 4 && rank <= 8;
  const staffLock = Number.isFinite(staff) && staff >= 78;
  const staffStrong = Number.isFinite(staff) && staff >= 62;
  const fitElite = Number.isFinite(fit) && fit >= 88;
  const fitStrong = Number.isFinite(fit) && fit >= 78;
  const needHot = Number.isFinite(need) && need >= 85;
  const ufOwns = Number.isFinite(ufPct) && ufPct >= 55;
  const ufClose =
    Number.isFinite(ufPct) && ufPct >= 35 && Number.isFinite(leadPct) && Math.abs(ufPct - leadPct) <= 12;
  const rivalFight =
    lead &&
    !/florida|^uf$|gators/i.test(lead) &&
    Number.isFinite(ufPct) &&
    Number.isFinite(leadPct) &&
    Math.abs(ufPct - leadPct) <= 18;

  // #1-3: own the lane — confident, no hedge tags
  if (topOfBoard) {
    if (ufOwns && (staffLock || staffStrong)) {
      return `Florida already owns this ${pos} on the board \u2014 staff is locked on ${ln}, and that\u2019s why he\u2019s sitting at the top of the chase.`;
    }
    if (ufOwns && fitElite) {
      return `Florida\u2019s already got the lead on ${ln} \u2014 elite ${pos} fit, and the board has him where a true must-get belongs.`;
    }
    if (needHot && gapLine && staffStrong) {
      return `${ln}\u2019s this high because ${gapLine} and Florida\u2019s staff is all-in on him as the ${pos} fix.`;
    }
    if (needHot && gapLine) {
      return `${ln} sits this high because ${gapLine} \u2014 Florida\u2019s chasing him as the ${pos} answer in this class.`;
    }
    if (fitElite && staffStrong) {
      return `Staff won\u2019t let ${ln} walk \u2014 must-get ${pos} fit, and the board ranks him like it.`;
    }
    if (staffLock || staffStrong) {
      return `Staff has ${ln} marked as a real ${pos} priority \u2014 that\u2019s why he\u2019s this high on our chase.`;
    }
    if (ufOwns) {
      return `Florida\u2019s already ahead on ${ln} \u2014 that\u2019s why he\u2019s this high on the chase.`;
    }
    return `${ln}\u2019s this high because Florida\u2019s ranking him as a true ${pos} priority on this board.`;
  }

  // #4-8: still sharp
  if (midBoard) {
    if (rivalFight && staffStrong) {
      return `There\u2019s a real fight for ${ln} right now \u2014 Florida\u2019s staff is still in it, and that\u2019s why he\u2019s this high on our chase.`;
    }
    if (ufClose && fitStrong) {
      return `${ln}\u2019s still a live ${pos} chase \u2014 the board\u2019s tight, the fit\u2019s real, and Florida\u2019s treating him like a name that can move.`;
    }
    if (needHot && gapLine) {
      return `${ln} stays this high because ${gapLine} \u2014 Florida\u2019s still chasing him as a ${pos} answer in this class.`;
    }
    if (fitElite || (fitStrong && staffStrong)) {
      return `${ln}\u2019s this high because the ${pos} fit is too clean to ignore \u2014 staff\u2019s still treating him like a real chase.`;
    }
    if (Number.isFinite(market) && market >= 72 && staffStrong) {
      return `${ln} stays on the chase because Florida\u2019s still in the ${pos} fight \u2014 staff\u2019s invested, and the board hasn\u2019t cooled.`;
    }
    return `${ln}\u2019s this high because Florida\u2019s still ranking him as a live ${pos} target on this board.`;
  }

  // #9+: honest, still elite — no soft hedges
  if (rivalFight && staffStrong) {
    return `There\u2019s still a live fight for ${ln} \u2014 Florida\u2019s staff hasn\u2019t backed off the ${pos} chase.`;
  }
  if (rivalFight) {
    return `${ln} stays on the board because the ${pos} fight is still live \u2014 Florida\u2019s in it.`;
  }
  if (fitStrong && staffStrong) {
    return `${ln} stays on the chase because the ${pos} fit still grades and staff\u2019s still invested.`;
  }
  if (needHot && gapLine) {
    return `${ln} stays on the chase because ${gapLine} \u2014 Florida still needs him as a ${pos} piece.`;
  }
  if (staffStrong) {
    return `Staff\u2019s still on ${ln} \u2014 that\u2019s why this ${pos} stays on our chase.`;
  }
  return `${ln} stays on the chase as a live ${pos} name Florida still wants in this class.`;
}

function resolveWhyWeChase(player, opts = {}) {
  const slug = String(player?.slug || '').trim().toLowerCase();
  const override = getOverride(slug);
  if (override) return String(override).trim();
  return generateWhyWeChase(player, opts);
}

/**
 * Attach whyWeChase without reordering the HP array.
 * Chase rank = priorityScore order (same as Priority Chase cards).
 */
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
    const text = resolveWhyWeChase(p, { chaseRank });
    return { ...p, whyWeChase: text, chaseRank };
  });
}

module.exports = {
  generateWhyWeChase,
  resolveWhyWeChase,
  attachWhyWeChaseToPlayers,
  lastName,
  posLabel,
};
