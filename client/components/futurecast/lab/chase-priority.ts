import { ufPctFromFc, type FcLabTarget } from './fc-lab-types';
import { topThreatVsFlorida } from './competing-schools';

export type ChaseLaneScores = {
  staffHeat?: number;
  mustGetFit?: number;
  positionalNeed?: number;
  geoPipeline?: number;
  marketPressure?: number;
};

export type ChaseBadges = {
  quietChase?: boolean;
  inState?: boolean;
  homeVisit?: boolean;
  staffAssigned?: boolean;
};

/** Extended Lab target fields used by Priority chase cards. */
export type ChaseTargetExtras = {
  priorityScore?: number | null;
  notePreview?: string | null;
  visitLabels?: string[];
  hotLanes?: ChaseLaneScores | null;
  hotBadges?: ChaseBadges | null;
  nationalRank?: number | null;
  /** Live API Why we chase — prefer this over client generate (editable anytime). */
  whyWeChase?: string | null;
};

function laneRank(lanes: ChaseLaneScores | null | undefined): Array<{ key: keyof ChaseLaneScores; score: number }> {
  if (!lanes) return [];
  return (
    [
      { key: 'staffHeat' as const, score: Number(lanes.staffHeat) || 0 },
      { key: 'mustGetFit' as const, score: Number(lanes.mustGetFit) || 0 },
      { key: 'positionalNeed' as const, score: Number(lanes.positionalNeed) || 0 },
      { key: 'geoPipeline' as const, score: Number(lanes.geoPipeline) || 0 },
      { key: 'marketPressure' as const, score: Number(lanes.marketPressure) || 0 },
    ]
      .filter((x) => x.score >= 35)
      .sort((a, b) => b.score - a.score)
  );
}

function laneScore(lanes: ChaseLaneScores | null | undefined, key: keyof ChaseLaneScores): number {
  return Number(lanes?.[key]) || 0;
}

function laneLabel(key: keyof ChaseLaneScores): string {
  switch (key) {
    case 'staffHeat':
      return 'Staff heat is high';
    case 'mustGetFit':
      return 'Must-get scheme fit';
    case 'positionalNeed':
      return 'Fills a thin room';
    case 'geoPipeline':
      return 'In-state pipeline';
    case 'marketPressure':
      return 'Market pressure this week';
    default:
      return '';
  }
}

/**
 * Plain-English reasons this name sits at this chase rank - not Florida odds alone.
 */
export function buildChaseWhy(
  player: FcLabTarget & ChaseTargetExtras
): { bullets: string[]; summary: string } {
  const bullets: string[] = [];
  const badges = player.hotBadges;
  const lanes = laneRank(player.hotLanes);

  for (const lane of lanes.slice(0, 2)) {
    if (lane.key === 'positionalNeed' && !isTrueThinRoom(player.position, lane.score)) {
      continue;
    }
    const label = laneLabel(lane.key);
    if (label) bullets.push(label);
  }

  if (badges?.staffAssigned && !bullets.some((b) => /staff/i.test(b))) {
    bullets.push('Staff already assigned');
  }
  if (badges?.homeVisit) bullets.push('Home visit logged');
  if (badges?.quietChase) bullets.push('Quiet chase - process over noise');
  if (badges?.inState && !bullets.some((b) => /in-state/i.test(b))) {
    bullets.push('Florida pipeline');
  }

  const visits = (player.visitLabels ?? []).filter(Boolean).slice(0, 2);
  if (visits.length) bullets.push(visits.join(' · '));

  const note = String(player.notePreview || '').trim();
  if (note && !looksLikeTraitNote(note) && bullets.length < 3) {
    const chip = processNoteTail(note);
    if (chip) bullets.push(chip);
  }

  const threat = topThreatVsFlorida(player);
  if (threat?.name && bullets.length < 3) {
    bullets.push(`Board fight with ${threat.label || threat.name}`);
  }

  const fit = player.fitScore != null ? Math.round(Number(player.fitScore)) : 0;
  if (fit >= 80 && !bullets.some((b) => /scheme|fit/i.test(b))) {
    bullets.push(`Elite scheme fit (${fit})`);
  }

  const unique = [...new Set(bullets)].slice(0, 3);
  const summary =
    unique.length > 0
      ? unique.join(' · ')
      : 'Ranked on GatorVault chase heat - priority for the class, not current lead.';

  return { bullets: unique, summary };
}

/** Trait / scheme blurbs belong on the profile - not the chase card. */
function looksLikeTraitNote(note: string): boolean {
  return /\b(fits|comps? to|first-step|press\/man|bend|burst|arc|length|twitch|physicality|scheme)\b/i.test(
    note
  );
}

/**
 * Fan-facing chase brief — truth-first why THIS name is this high.
 * Only claim need / talent / process / fight when the data supports it.
 * Never "backyard." Never forced position-of-need mad-libs.
 */
const WHY_BRIEF_MAX = 280;
/**
 * Thin-room copy only for cycle trench / coverage gaps, and only when the
 * static need weight is actually high. WR/RB/TE/S/QB/ATH never get "thin room"
 * from the weight table alone — that was lying about loaded rooms.
 */
const TRUE_NEED_MIN = 85;
const THIN_ROOM_ELIGIBLE = new Set([
  'EDGE',
  'DE',
  'DL',
  'DT',
  'OT',
  'OL',
  'IOL',
  'OG',
  'C',
  'LB',
  'ILB',
  'OLB',
  'CB',
]);

function isTrueThinRoom(position: string | null | undefined, needScore: number): boolean {
  const pos = String(position || '')
    .trim()
    .toUpperCase();
  return THIN_ROOM_ELIGIBLE.has(pos) && Number(needScore) >= TRUE_NEED_MIN;
}

function clipWhyBrief(text: string, max = WHY_BRIEF_MAX): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/**
 * Compress process intel into a short Vault chip.
 * Never dump raw notes with mid-sentence "…" — that reads unfinished, not elite.
 */
function processNoteTail(note: string): string | null {
  const raw = String(note || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*Continuous allowlist intel sweep\.?/gi, '')
    .trim();
  if (!raw || looksLikeTraitNote(raw)) return null;

  const lower = raw.toLowerCase();

  // Visit / UOV narratives → one clean chip
  if (
    /\b(visited|visit(?:ed)?|uov|unofficial|official)\b/.test(lower) &&
    /\b(florida|gators|gainesville|\buf\b)\b/.test(lower)
  ) {
    if (/\buov\b|unofficial/.test(lower)) return 'UF UOV on file';
    if (/\bofficial\b|\bov\b/.test(lower)) return 'UF OV on file';
    return 'UF visit already on file';
  }

  // Offer narratives
  if (
    (/\boffer(?:ed)?\b/.test(lower) && /\b(florida|gators|\buf\b)\b/.test(lower)) ||
    /\bflorida offer\b/.test(lower)
  ) {
    return 'Florida offer on file';
  }

  // Already a short, complete process line (e.g. "Florida offered · June 15 UOV on file")
  if (raw.length <= 56 && !/\b(and is|and are|and will)\b/i.test(raw) && !/…|\.\.\.\s*$/.test(raw)) {
    const processLike =
      /\b(offer|offered|visit|uov|ov|staff|push|campus|gainesville|unofficial|official|rpm)\b/i.test(
        raw
      );
    return processLike ? raw : null;
  }

  // Long / incomplete prose — skip rather than clip mid-thought
  return null;
}

function lastName(name: string | null | undefined): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(p));
  return parts.length ? parts[parts.length - 1] : 'Him';
}

function posNugget(pos: string | null | undefined): string {
  const p = String(pos || '').toUpperCase();
  if (p === 'EDGE' || p === 'DE' || p === 'OLB') return 'edge';
  if (p === 'DT' || p === 'DL' || p === 'NT') return 'DL';
  if (p === 'CB') return 'CB';
  if (p === 'S' || p === 'SAF') return 'safety';
  if (p === 'WR') return 'WR';
  if (p === 'RB') return 'RB';
  if (p === 'QB') return 'QB';
  if (p === 'OT' || p === 'OL' || p === 'IOL' || p === 'OG' || p === 'OC' || p === 'C') return 'OL';
  if (p === 'TE') return 'TE';
  if (p === 'LB' || p === 'ILB' || p === 'MLB') return 'LB';
  if (p === 'ATH') return 'athlete';
  return p || 'prospect';
}

function needGapLine(pos: string | null | undefined, need: number): string {
  if (!(need >= TRUE_NEED_MIN)) return '';
  const p = String(pos || '').toUpperCase();
  if (p === 'EDGE' || p === 'DE' || p === 'OLB' || p === 'DT' || p === 'DL' || p === 'NT') {
    return 'the trench room is thin';
  }
  if (p === 'CB') return 'the secondary needs another lockdown piece';
  return '';
}

function boardPct(player: FcLabTarget & ChaseTargetExtras): number {
  if (player.ufRpmPct != null && Number(player.ufRpmPct) > 0) {
    return Math.round(Number(player.ufRpmPct));
  }
  return ufPctFromFc(player.ufProbability);
}

export type ChaseWhyBriefOpts = {
  /** Priority Chase stamp rank (#1, #43, …). Explains this spot on OUR board. */
  chaseRank?: number | null;
};

/**
 * Fan-facing chase brief — insider nugget for why THIS name sits THIS high.
 * Prefer live `player.whyWeChase` from HP API (editable anytime, no Codemagic).
 * Fallback generates prose — no score dumps, no hometown lead.
 */
export function buildChaseWhyBrief(
  player: FcLabTarget & ChaseTargetExtras,
  opts: ChaseWhyBriefOpts = {}
): string {
  const live = String(player.whyWeChase || '').trim();
  if (live) return clipWhyBrief(live);

  const rank =
    opts.chaseRank != null && Number(opts.chaseRank) > 0
      ? Math.round(Number(opts.chaseRank))
      : 1;
  const ln = lastName(player.name);
  const pos = posNugget(player.position);
  const staff = laneScore(player.hotLanes, 'staffHeat');
  const fitLane = laneScore(player.hotLanes, 'mustGetFit');
  const need = laneScore(player.hotLanes, 'positionalNeed');
  const market = laneScore(player.hotLanes, 'marketPressure');
  const fit = player.fitScore != null ? Math.round(Number(player.fitScore)) : 0;
  const fitScore = Math.max(fitLane, fit);
  const pct = boardPct(player);
  const threat = topThreatVsFlorida(player);
  const lead = threat?.label || threat?.name || '';
  const leadPct = threat?.pct != null ? Math.round(Number(threat.pct)) : NaN;
  const gapLine = needGapLine(player.position, need);
  const staffOn = staff >= 55 || Boolean(player.hotBadges?.staffAssigned);

  const topOfBoard = rank <= 3;
  const midBoard = rank >= 4 && rank <= 8;
  const staffLock = staff >= 78 || (staffOn && staff >= 62);
  const staffStrong = staff >= 62 || staffOn;
  const fitElite = fitScore >= 88;
  const fitStrong = fitScore >= 78;
  const needHot = need >= TRUE_NEED_MIN && Boolean(gapLine);
  const ufOwns = pct >= 55;
  const ufClose =
    pct >= 35 && Number.isFinite(leadPct) && Math.abs(pct - leadPct) <= 12;
  const rivalFight =
    Boolean(lead) &&
    pct > 0 &&
    Number.isFinite(leadPct) &&
    Math.abs(pct - leadPct) <= 18 &&
    pct < 55;

  let text = '';

  if (topOfBoard) {
    if (ufOwns && (staffLock || staffStrong)) {
      text = `Florida already owns this ${pos} on the board — staff is locked on ${ln}, and that’s why he’s sitting at the top of the chase.`;
    } else if (ufOwns && fitElite) {
      text = `Florida’s already got the lead on ${ln} — elite ${pos} fit, and the board has him where a true must-get belongs.`;
    } else if (needHot && staffStrong) {
      text = `${ln}’s this high because ${gapLine} and Florida’s staff is all-in on him as a ${pos} fix — not a filler name.`;
    } else if (needHot) {
      text = `${ln} sits this high because ${gapLine} — Florida’s chasing him as a real ${pos} answer, not a depth add.`;
    } else if (fitElite && staffStrong) {
      text = `${ln}’s this high because the staff won’t let this ${pos} walk — must-get fit, and the board ranks him like it.`;
    } else if (staffLock || staffStrong) {
      text = `Staff has ${ln} marked as a real ${pos} priority — that’s why he’s sitting this high on our chase, not mid-board noise.`;
    } else if (ufOwns) {
      text = `Florida’s already ahead on ${ln} — that’s why he’s this high on the chase while the board still has him in play.`;
    } else {
      text = `${ln}’s this high because Florida’s ranking him as a true ${pos} priority on this board — process and fit, not a random bump.`;
    }
  } else if (midBoard) {
    if (rivalFight && staffStrong) {
      text = `There’s a real fight for ${ln} right now — Florida’s staff is still in it, and that’s why he’s this high on our chase.`;
    } else if (ufClose && fitStrong) {
      text = `${ln}’s still a live ${pos} chase — the board’s tight, the fit’s real, and Florida’s treating him like a name that can move.`;
    } else if (needHot) {
      text = `${ln} stays this high because ${gapLine} — Florida’s still chasing him as a ${pos} answer in this class.`;
    } else if (fitElite || (fitStrong && staffStrong)) {
      text = `${ln}’s this high because the ${pos} fit is too clean to ignore — staff’s still treating him like a real chase, not a watch-list name.`;
    } else if (market >= 72 && staffStrong) {
      text = `${ln} stays on the chase because Florida’s still in the ${pos} fight — staff’s invested, and the board hasn’t cooled.`;
    } else {
      text = `${ln}’s this high because Florida’s still ranking him as a live ${pos} target on this board — not a filler slot.`;
    }
  } else if (rivalFight) {
    text = `${ln}’s still on the board because there’s a live fight for him — Florida’s chasing, even if he’s not the top name right now.`;
  } else if (fitStrong && staffStrong) {
    text = `${ln} stays on the chase because the ${pos} fit still grades — staff’s interested, even mid-board.`;
  } else if (needHot) {
    text = `${ln}’s still here because ${gapLine} — Florida’s keeping eyes on him as a ${pos} option.`;
  } else {
    text = `${ln}’s still on the chase as a live ${pos} name — not the top of the board, but Florida hasn’t walked away.`;
  }

  return clipWhyBrief(text.replace(/\bbackyard\b/gi, 'in-state'));
}

export function chaseHeatLabel(score: number | null | undefined): string {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return String(Math.round(n));
}

export function chaseFightLine(player: FcLabTarget): string {
  const pct = ufPctFromFc(player.ufProbability);
  const threat = topThreatVsFlorida(player);
  if (threat?.name) {
    return `${pct}% Florida · vs ${threat.label || threat.name}`;
  }
  return pct > 0 ? `${pct}% Florida odds` : 'Florida odds pending';
}
