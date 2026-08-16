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
    const short = note.length > 72 ? `${note.slice(0, 69).trim()}…` : note;
    bullets.push(short);
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
 * Fan-facing chase brief for card skinny - why Florida is chasing him,
 * not how he plays. Traits stay on the profile.
 */
export function buildChaseWhyBrief(player: FcLabTarget & ChaseTargetExtras): string {
  const pct = ufPctFromFc(player.ufProbability);
  const fit = player.fitScore != null ? Math.round(Number(player.fitScore)) : 0;
  const lanes = laneRank(player.hotLanes);
  const threat = topThreatVsFlorida(player);
  const inState =
    Boolean(player.hotBadges?.inState) ||
    /\bFL\b|\(FL\)|Florida/i.test(String(player.school || ''));
  const pos = String(player.position || 'prospect').toUpperCase();
  const last = String(player.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-1)[0] || 'He';

  const headLane = lanes[0]?.key;
  let lead = '';
  if (headLane === 'positionalNeed') {
    lead = `Top ${pos} need for the class`;
  } else if (headLane === 'mustGetFit' || fit >= 80) {
    lead = `Must-get scheme fit (${fit || '-'})`;
  } else if (headLane === 'staffHeat' || player.hotBadges?.staffAssigned) {
    lead = 'Staff heat is already on him';
  } else if (pct >= 35) {
    lead = `Best Florida shot on this board (${pct}%)`;
  } else if (inState) {
    lead = 'In-state pipeline Florida has to keep warm';
  } else {
    lead = "Ranked on chase heat — priority for the class, not today's lead";
  }

  const tails: string[] = [];
  const visitBits = (player.visitLabels ?? []).filter(Boolean).slice(0, 2);
  if (visitBits.length) tails.push(visitBits.join(' · '));
  if (inState && !/in-state/i.test(lead)) tails.push('in-state');
  if (threat?.name) {
    tails.push(
      pct > 0 && pct < 40
        ? `live fight with ${threat.label || threat.name} while Florida still sits at ${pct}%`
        : `board fight with ${threat.label || threat.name}`
    );
  } else if (pct > 0 && pct < 35 && !/Florida shot/i.test(lead)) {
    tails.push(`still a live chase at ${pct}% UF`);
  }
  if (fit >= 75 && fit < 80 && !/fit/i.test(lead)) {
    tails.push(`Fit ${fit} keeps ${last} high`);
  }

  if (!tails.length) {
    const fallback = buildChaseWhy(player).summary;
    return fallback.endsWith('.') ? fallback : `${fallback}.`;
  }

  return `${lead} - ${tails.slice(0, 3).join('; ')}.`;
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
