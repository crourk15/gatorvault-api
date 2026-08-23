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

/** City / school place for in-state copy — never "backyard." */
function placeFromSchool(school: string | null | undefined): string | null {
  const s = String(school || '').trim();
  if (!s) return null;
  const paren = s.match(/\(([^,)/]+)/);
  if (paren?.[1]) return paren[1].trim();
  const head = s.split('(')[0].trim();
  return head ? head.slice(0, 28) : null;
}

function starBand(stars: number | null | undefined): string | null {
  const n = Number(stars);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 5) return 'Five-star';
  if (n >= 4) return 'Four-star';
  if (n >= 3) return 'Three-star';
  return null;
}

function isEliteTalent(player: FcLabTarget & ChaseTargetExtras): boolean {
  const stars = Number(player.stars) || 0;
  const nat =
    player.nationalRank != null && Number(player.nationalRank) > 0
      ? Number(player.nationalRank)
      : null;
  if (stars >= 5) return true;
  if (nat != null && nat <= 25) return true;
  if (stars >= 4 && nat != null && nat <= 75) return true;
  return false;
}

function talentStatusLine(
  player: FcLabTarget & ChaseTargetExtras,
  pos: string,
  place: string | null,
  inState: boolean
): string | null {
  const stars = starBand(player.stars);
  const nat =
    player.nationalRank != null && Number(player.nationalRank) > 0
      ? Math.round(Number(player.nationalRank))
      : null;
  const where = place || (inState ? 'in-state' : null);

  if (nat != null && nat <= 10) {
    return where
      ? `Top-10 ${pos} nationally from ${where}`
      : `Top-10 ${pos} nationally`;
  }
  if (nat != null && nat <= 25) {
    return where
      ? `Top-25 ${pos} from ${where}`
      : `Top-25 ${pos} nationally`;
  }
  if (stars) {
    return where ? `${stars} ${pos} from ${where}` : `${stars} ${pos}`;
  }
  return null;
}

export function buildChaseWhyBrief(player: FcLabTarget & ChaseTargetExtras): string {
  const pct = ufPctFromFc(player.ufProbability);
  const fit = player.fitScore != null ? Math.round(Number(player.fitScore)) : 0;
  const needScore = laneScore(player.hotLanes, 'positionalNeed');
  const staffScore = laneScore(player.hotLanes, 'staffHeat');
  const fitLane = laneScore(player.hotLanes, 'mustGetFit');
  const threat = topThreatVsFlorida(player);
  const inState =
    Boolean(player.hotBadges?.inState) ||
    /\bFL\b|\(FL\)|,\s*FL\b/i.test(String(player.school || ''));
  const pos = String(player.position || 'prospect').toUpperCase();
  const last =
    String(player.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-1)[0] || 'He';
  const place = placeFromSchool(player.school);
  const trueNeed = isTrueThinRoom(pos, needScore);
  const eliteTalent = isEliteTalent(player);
  const status = talentStatusLine(player, pos, place, inState);
  const staffOn = staffScore >= 55 || Boolean(player.hotBadges?.staffAssigned);
  const mustGet = fit >= 80 || fitLane >= 70;

  // Lead = the real reason he's this high — only claim need when trueNeed fires.
  let lead = '';
  if (eliteTalent && !trueNeed && status) {
    lead = `${status} Florida still chases even with the room set`;
  } else if (eliteTalent && trueNeed && status) {
    lead = fit >= 75 ? `${status} for a thin ${pos} room (Fit ${fit})` : `${status} for a thin ${pos} room`;
  } else if (trueNeed && fit >= 75) {
    lead = `Thin ${pos} room + Fit ${fit}`;
  } else if (trueNeed) {
    lead = `Thin ${pos} room Florida has to fill`;
  } else if (pct >= 50 && inState && status) {
    lead = `${status} — Florida leads the On3 board`;
  } else if (pct >= 50 && inState) {
    lead = place
      ? `${place} ${pos} with Florida leading On3`
      : `In-state ${pos} with Florida leading On3`;
  } else if (pct >= 35) {
    lead = status
      ? `${status} — Florida's best shot on this board (${pct}%)`
      : `Florida's best shot on this board (${pct}%)`;
  } else if (mustGet && status) {
    lead = `${status} — must-get Fit (${fit || '—'})`;
  } else if (mustGet) {
    lead = `Must-get Fit (${fit || '—'}) on the board`;
  } else if (staffOn && status) {
    lead = `${status} — staff already on ${last}`;
  } else if (staffOn) {
    lead = `Staff already on ${last}`;
  } else if (inState && status) {
    lead = `${status} Florida has to keep warm`;
  } else if (inState && place) {
    lead = `${place} ${pos} Florida has to keep warm`;
  } else if (status) {
    lead = `${status} ranked on chase heat`;
  } else {
    lead = "Ranked on chase heat — priority for the class, not today's lead";
  }

  // Never let "backyard" slip in from any string assembly.
  lead = lead.replace(/\bbackyard\b/gi, 'in-state');

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

  if (inState && !/in-state|florida kid|\bFL\b|Tampa|Mandarin|Jacksonville|Tallahassee|Pensacola|Hudson|Miami|Orlando|Gainesville/i.test(lead)) {
    if (place && !lead.includes(place)) tails.push(`from ${place}`);
    else if (!place) tails.push('in-state');
  }

  if (threat?.name) {
    const rival = threat.label || threat.name;
    if (!lead.toLowerCase().includes(String(rival).toLowerCase())) {
      tails.push(
        pct > 0 && pct < 40
          ? `live fight with ${rival} while Florida still sits at ${pct}%`
          : `board fight with ${rival}`
      );
    }
  } else if (pct > 0 && pct < 35 && !/best shot|leading On3/i.test(lead)) {
    tails.push(`still a live chase at ${pct}% UF`);
  }

  if (fit >= 75 && fit < 80 && !/fit/i.test(lead) && !trueNeed) {
    tails.push(`Fit ${fit} keeps ${last} high`);
  }

  if (!tails.length) {
    const fallback = buildChaseWhy(player).summary;
    const withStop = fallback.endsWith('.') ? fallback : `${fallback}.`;
    return clipWhyBrief(withStop.replace(/\bbackyard\b/gi, 'in-state'));
  }

  return clipWhyBrief(`${lead} — ${tails.slice(0, 3).join('; ')}.`.replace(/\bbackyard\b/gi, 'in-state'));
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
