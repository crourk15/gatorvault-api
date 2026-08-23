'use strict';

/**
 * Why we chase — rank-truth prose for Priority Chase cards.
 * Prefer live override (Admin / upsert script); else generate from chase factors.
 * Editable anytime via API — no Codemagic for copy changes after client reads whyWeChase.
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
  if (stamped && stamped !== '-' && stamped !== '—') return stamped;
  const peers = Array.isArray(player?.competingSchools) ? player.competingSchools : [];
  const top = peers
    .filter((s) => s?.name && Number(s.pct) > 0 && !/florida|^uf$|gators/i.test(String(s.name)))
    .sort((a, b) => Number(b.pct) - Number(a.pct))[0];
  return top ? String(top.name) : '';
}

/**
 * Insider nugget — why THIS name sits THIS high on OUR board.
 * No score dumps. No “not because he’s from X.”
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
  const ufClose = Number.isFinite(ufPct) && ufPct >= 35 && Number.isFinite(leadPct) && Math.abs(ufPct - leadPct) <= 12;
  const rivalFight =
    lead &&
    !/florida|^uf$|gators/i.test(lead) &&
    Number.isFinite(ufPct) &&
    Number.isFinite(leadPct) &&
    Math.abs(ufPct - leadPct) <= 18;

  // #1–3: own the lane
  if (topOfBoard) {
    if (ufOwns && staffLock) {
      return `Florida already owns this ${pos} on the board — staff is locked on ${ln}, and that’s why he’s sitting at the top of the chase.`;
    }
    if (ufOwns && fitElite) {
      return `Florida’s already got the lead on ${ln} — elite ${pos} fit, and the board has him where a true must-get belongs.`;
    }
    if (needHot && gapLine && staffStrong) {
      return `${ln}’s this high because ${gapLine} and Florida’s staff is all-in on him as a ${pos} fix — not a filler name.`;
    }
    if (needHot && gapLine) {
      return `${ln} sits this high because ${gapLine} — Florida’s chasing him as a real ${pos} answer, not a depth add.`;
    }
    if (fitElite && staffStrong) {
      return `${ln}’s this high because the staff won’t let this ${pos} walk — must-get fit, and the board ranks him like it.`;
    }
    if (staffLock) {
      return `Staff has ${ln} marked as a real ${pos} priority — that’s why he’s sitting this high on our chase, not mid-board noise.`;
    }
    if (ufOwns) {
      return `Florida’s already ahead on ${ln} — that’s why he’s this high on the chase while the board still has him in play.`;
    }
    return `${ln}’s this high because Florida’s ranking him as a true ${pos} priority on this board — process and fit, not a random bump.`;
  }

  // #4–8: clear reason, not top
  if (midBoard) {
    if (rivalFight && staffStrong) {
      return `There’s a real fight for ${ln} right now — Florida’s staff is still in it, and that’s why he’s this high on our chase.`;
    }
    if (ufClose && fitStrong) {
      return `${ln}’s still a live ${pos} chase — the board’s tight, the fit’s real, and Florida’s treating him like a name that can move.`;
    }
    if (needHot && gapLine) {
      return `${ln} stays this high because ${gapLine} — Florida’s still chasing him as a ${pos} answer in this class.`;
    }
    if (fitElite || (fitStrong && staffStrong)) {
      return `${ln}’s this high because the ${pos} fit is too clean to ignore — staff’s still treating him like a real chase, not a watch-list name.`;
    }
    if (Number.isFinite(market) && market >= 72 && staffStrong) {
      return `${ln} stays on the chase because Florida’s still in the ${pos} fight — staff’s invested, and the board hasn’t cooled.`;
    }
    return `${ln}’s this high because Florida’s still ranking him as a live ${pos} target on this board — not a filler slot.`;
  }

  // #9+: honest mid/late
  if (rivalFight) {
    return `${ln}’s still on the board because there’s a live fight for him — Florida’s chasing, even if he’s not the top name right now.`;
  }
  if (fitStrong && staffStrong) {
    return `${ln} stays on the chase because the ${pos} fit still grades — staff’s interested, even mid-board.`;
  }
  if (needHot && gapLine) {
    return `${ln}’s still here because ${gapLine} — Florida’s keeping eyes on him as a ${pos} option.`;
  }
  return `${ln}’s still on the chase as a live ${pos} name — not the top of the board, but Florida hasn’t walked away.`;
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
