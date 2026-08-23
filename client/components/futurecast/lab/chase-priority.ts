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
const WHY_BRIEF_MAX = 180;
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


function starBand(stars: number | null | undefined): string | null {
  const n = Number(stars);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 5) return 'Five-star';
  if (n >= 4) return 'Four-star';
  if (n >= 3) return 'Three-star';
  return null;
}

/**
 * Who he is on the talent board — never "from Tallahassee" (school is already on the card).
 */
function talentIdentity(player: FcLabTarget & ChaseTargetExtras, pos: string): string | null {
  const stars = starBand(player.stars);
  const nat =
    player.nationalRank != null && Number(player.nationalRank) > 0
      ? Math.round(Number(player.nationalRank))
      : null;

  if (nat != null && nat <= 10) return `Top-10 ${pos} nationally`;
  if (nat != null && nat <= 25) return `Top-25 ${pos} nationally`;
  if (nat != null && nat <= 75) return `#${nat} ${pos} nationally`;
  if (nat != null && nat <= 200 && stars) return `${stars} ${pos} · #${nat} nationally`;
  if (nat != null && nat <= 200) return `#${nat} ${pos} nationally`;
  if (stars) return `${stars} ${pos}`;
  return null;
}

function boardPct(player: FcLabTarget & ChaseTargetExtras): number {
  if (player.ufRpmPct != null && Number(player.ufRpmPct) > 0) {
    return Math.round(Number(player.ufRpmPct));
  }
  return ufPctFromFc(player.ufProbability);
}

function priorityHeat(player: FcLabTarget & ChaseTargetExtras): number | null {
  const n = Number(player.priorityScore);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type ChaseWhyBriefOpts = {
  /** Priority Chase stamp rank (#1, #43, …). Explains this spot on OUR board. */
  chaseRank?: number | null;
};

/**
 * Fan-facing chase brief — why THIS name sits at THIS chase rank today.
 * Talent + board/priority/process/fight. Never hometown as the reason.
 * Thin room only as support when the gap is real.
 */
export function buildChaseWhyBrief(
  player: FcLabTarget & ChaseTargetExtras,
  opts: ChaseWhyBriefOpts = {}
): string {
  const pct = boardPct(player);
  const fit = player.fitScore != null ? Math.round(Number(player.fitScore)) : 0;
  const needScore = laneScore(player.hotLanes, 'positionalNeed');
  const staffScore = laneScore(player.hotLanes, 'staffHeat');
  const fitLane = laneScore(player.hotLanes, 'mustGetFit');
  const market = laneScore(player.hotLanes, 'marketPressure');
  const threat = topThreatVsFlorida(player);
  const pos = String(player.position || 'prospect').toUpperCase();
  const last =
    String(player.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-1)[0] || 'He';
  const trueNeed = isTrueThinRoom(pos, needScore);
  const identity = talentIdentity(player, pos);
  const staffOn = staffScore >= 55 || Boolean(player.hotBadges?.staffAssigned);
  const mustGet = fit >= 80 || fitLane >= 70;
  const pri = priorityHeat(player);
  const rank =
    opts.chaseRank != null && Number(opts.chaseRank) > 0
      ? Math.round(Number(opts.chaseRank))
      : null;
  const floridaLeads = pct >= 55;
  const floridaCompetitive = pct >= 30 && pct < 55;
  const rival = threat?.label || threat?.name || null;

  // --- Lead: what puts him at THIS chase rank ---
  let lead = '';

  if (rank === 1) {
    if (identity && floridaLeads) {
      lead = `${identity} — Florida owns the On3 board (${pct}%); #1 on Priority Chase`;
    } else if (identity && mustGet) {
      lead = `${identity} — must-get Fit ${fit} sits #1 on Priority Chase`;
    } else if (identity) {
      lead = `${identity} — #1 on Priority Chase for chase heat${pri != null ? ` (${pri})` : ''}`;
    } else if (floridaLeads) {
      lead = `Florida owns this On3 board (${pct}%) — #1 on Priority Chase`;
    } else {
      lead = `#1 on Priority Chase${pri != null ? ` — heat ${pri}` : ''}`;
    }
  } else if (rank != null && rank <= 5) {
    if (identity && floridaLeads) {
      lead = `${identity} — Florida leads On3 (${pct}%); locked inside the top 5 chase`;
    } else if (identity && mustGet) {
      lead = `${identity} — Fit ${fit} keeps him #${rank} on Priority Chase`;
    } else if (identity) {
      lead = `${identity} — #${rank} on Priority Chase${pri != null ? ` (heat ${pri})` : ''}`;
    } else {
      lead = `#${rank} on Priority Chase${pri != null ? ` — heat ${pri}` : ''}`;
    }
  } else if (rank != null && rank <= 15) {
    if (identity && floridaLeads) {
      lead = `${identity} — Florida board lead (${pct}%) holds #${rank} chase`;
    } else if (identity && floridaCompetitive) {
      lead = `${identity} — live Florida shot (${pct}%) keeps #${rank} chase`;
    } else if (identity && mustGet) {
      lead = `${identity} — Fit ${fit} is why he's #${rank} not off the board`;
    } else if (identity) {
      lead = `${identity} — chase heat${pri != null ? ` ${pri}` : ''} ranks him #${rank}`;
    } else {
      lead = `Chase heat${pri != null ? ` ${pri}` : ''} ranks him #${rank}`;
    }
  } else if (rank != null && rank <= 40) {
    if (identity && floridaCompetitive) {
      lead = `${identity} — still a real Florida chase at #${rank} (${pct}% On3)`;
    } else if (identity && staffOn) {
      lead = `${identity} — staff already on ${last}; #${rank} chase for a reason`;
    } else if (identity && mustGet) {
      lead = `${identity} — Fit ${fit} is the reason he's still #${rank}`;
    } else if (identity && market >= 55) {
      lead = `${identity} — market heat this week puts him at #${rank}`;
    } else if (identity) {
      lead = `${identity} — Priority${pri != null ? ` ${pri}` : ''} lands him at #${rank}`;
    } else {
      lead = `Priority${pri != null ? ` ${pri}` : ''} lands him at #${rank} on the chase`;
    }
  } else if (rank != null) {
    // Late board (#41+) — explain why he's still listed, not why he's elite.
    if (identity && staffOn) {
      lead = `${identity} — still on the board at #${rank} with staff assigned`;
    } else if (identity && market >= 50) {
      lead = `${identity} — #${rank} chase while the market moves`;
    } else if (identity && floridaCompetitive) {
      lead = `${identity} — #${rank} chase with Florida still at ${pct}%`;
    } else if (identity && trueNeed) {
      lead = `${identity} — #${rank} because Florida still needs ${pos} depth`;
    } else if (identity) {
      lead = `${identity} — watch-list chase at #${rank}${pri != null ? ` (heat ${pri})` : ''}`;
    } else {
      lead = `Watch-list chase at #${rank}${pri != null ? ` — heat ${pri}` : ''}`;
    }
  } else {
    // No rank passed — still explain the player, not hometown.
    if (identity && floridaLeads) {
      lead = `${identity} — Florida owns the On3 board (${pct}%)`;
    } else if (identity && mustGet) {
      lead = `${identity} — must-get Fit ${fit}`;
    } else if (identity && staffOn) {
      lead = `${identity} — staff already on ${last}`;
    } else if (identity) {
      lead = `${identity} ranked on chase heat${pri != null ? ` (${pri})` : ''}`;
    } else {
      lead = "Ranked on chase heat — priority for the class, not today's lead";
    }
  }

  lead = lead.replace(/\bbackyard\b/gi, 'in-state');

  // --- Tails: proof only (never "from Tallahassee") ---
  const tails: string[] = [];
  const visitBits = (player.visitLabels ?? []).filter(Boolean).slice(0, 2);
  if (visitBits.length) tails.push(visitBits.join(' · '));

  const processTail = processNoteTail(String(player.notePreview || ''));
  if (processTail) {
    const key = processTail.slice(0, 24).toLowerCase();
    if (!tails.some((t) => t.toLowerCase().includes(key)) && !lead.toLowerCase().includes(key)) {
      tails.push(processTail);
    }
  }

  if (staffOn && !/staff/i.test(lead) && tails.length < 2) {
    tails.push(`staff already on ${last}`);
  }

  if (trueNeed && !/thin|needs ${pos}|need ${pos}/i.test(lead) && tails.length < 2) {
    tails.push(`real ${pos} room gap`);
  }

  if (mustGet && fit >= 75 && !/fit/i.test(lead) && tails.length < 2) {
    tails.push(`Fit ${fit}`);
  }

  if (rival && !lead.toLowerCase().includes(String(rival).toLowerCase()) && tails.length < 2) {
    if (!floridaLeads && pct > 0 && pct < 50) {
      tails.push(`live fight with ${rival} while Florida sits at ${pct}%`);
    } else if (!floridaLeads) {
      tails.push(`board fight with ${rival}`);
    }
  }

  if (!tails.length) {
    const fallback = buildChaseWhy(player).summary;
    const withStop = fallback.endsWith('.') ? fallback : `${fallback}.`;
    return clipWhyBrief(withStop.replace(/\bbackyard\b/gi, 'in-state'));
  }

  return clipWhyBrief(`${lead} — ${tails.slice(0, 2).join('; ')}.`.replace(/\bbackyard\b/gi, 'in-state'));
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
