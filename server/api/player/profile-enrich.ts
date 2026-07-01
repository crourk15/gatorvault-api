/**
 * Recruiting-store enrichment for aggregated player profiles.
 */
import { getRecruitingPlayerBySlug } from '../players/recruiting-fallback';

function isFloridaSchool(value: unknown): boolean {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(String(value || ''));
}

function parseUfPct(raw: unknown): number {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function parseHeightInches(raw?: string | null): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d)[-']?\s*(\d{1,2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
}

function parseHtWt(htWt?: string | null): { height: number | null; weight: number | null } {
  const raw = String(htWt || '');
  const m = raw.match(/(\d-\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (!m) return { height: null, weight: null };
  return { height: parseHeightInches(m[1]), weight: Number(m[2]) };
}

export async function augmentPlayerFromRecruiting(
  slug: string,
  player: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const recruiting = await getRecruitingPlayerBySlug(slug);
  if (!recruiting) return player;

  const parsed = parseHtWt(recruiting.htWt);
  const height =
    player.height ??
    parseHeightInches(recruiting.height || null) ??
    parsed.height ??
    null;
  const weight = player.weight ?? recruiting.weight ?? parsed.weight ?? null;
  const ufCommit = isFloridaSchool(recruiting.committedTo);
  const storePct = parseUfPct(recruiting.ufProbability ?? recruiting.ufRpmPct);

  return {
    ...player,
    fullName: player.fullName ?? recruiting.name ?? player.slug,
    highSchool: player.highSchool ?? recruiting.school ?? recruiting.highSchool ?? null,
    hometown: player.hometown ?? recruiting.hometown ?? null,
    state: player.state ?? recruiting.state ?? null,
    stars: player.stars ?? recruiting.stars ?? null,
    compositeRating: player.compositeRating ?? recruiting.rating ?? null,
    rankingNational: player.rankingNational ?? recruiting.natlRank ?? null,
    rankingPosition: player.rankingPosition ?? recruiting.posRank ?? null,
    rankingState: player.rankingState ?? recruiting.stateRank ?? null,
    committedTo: player.committedTo ?? recruiting.committedTo ?? null,
    height,
    weight,
    ufFitScore:
      player.ufFitScore != null && Number(player.ufFitScore) > 0
        ? player.ufFitScore
        : ufCommit
          ? 100
          : storePct > 0
            ? storePct
            : player.ufFitScore,
  };
}

export async function enrichRelatedFromRecruiting(
  related: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const row of related) {
    const slug = String(row.slug || '').toLowerCase();
    if (!slug) {
      out.push(row);
      continue;
    }
    const recruiting = await getRecruitingPlayerBySlug(slug);
    if (!recruiting) {
      out.push(row);
      continue;
    }
    const ufCommit = isFloridaSchool(recruiting.committedTo);
    const storePct = parseUfPct(recruiting.ufProbability ?? recruiting.ufRpmPct);
    const ufScore = ufCommit ? 100 : storePct > 0 ? storePct : Number(row.ufFitScore ?? 0);

    out.push({
      ...row,
      fullName: row.fullName ?? recruiting.name ?? slug,
      position: row.position ?? recruiting.pos ?? recruiting.position ?? row.position,
      classYear: row.classYear ?? recruiting.classYear ?? row.classYear,
      stars: recruiting.stars ?? null,
      rating: recruiting.rating ?? null,
      compositeScore: recruiting.rating ?? null,
      nationalRank: recruiting.natlRank ?? null,
      natlRank: recruiting.natlRank ?? null,
      posRank: recruiting.posRank ?? null,
      stateRank: recruiting.stateRank ?? null,
      state: recruiting.state ?? null,
      school: recruiting.school ?? recruiting.highSchool ?? null,
      committedTo: recruiting.committedTo ?? null,
      isCommittedToUF: ufCommit,
      ufFitScore: ufScore,
      portalLikelihood: ufCommit ? 0 : row.portalLikelihood ?? 0,
      signalCount: row.signalCount ?? 0,
    });
  }
  return out;
}

export function competingSchoolsFromRecruiting(
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>
): Array<{
  school: string;
  rankNow: number;
  rankPrior: number | null;
  delta: number;
  volatilityBoost: number;
}> {
  if (!recruiting) return [];
  const competitors = (recruiting as { competitors?: Array<{ school?: string; score?: number }> })
    .competitors;
  if (!Array.isArray(competitors) || !competitors.length) return [];

  return competitors
    .filter((c) => c?.school && !isFloridaSchool(c.school))
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    .slice(0, 8)
    .map((c, i) => ({
      school: String(c.school),
      rankNow: i + 1,
      rankPrior: null,
      delta: 0,
      volatilityBoost: 0,
      pct: Math.round(Number(c.score) * 10) / 10,
    }));
}

export function boardSignalsFromRecruiting(
  playerId: string,
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>
): Record<string, unknown>[] {
  if (!recruiting) return [];
  const now = new Date().toISOString();
  const signals: Record<string, unknown>[] = [];
  const note = String(recruiting.profileNote ?? recruiting.skinny ?? '').trim();
  if (note) {
    signals.push({
      id: `${playerId}-staff-note`,
      playerId,
      signalType: 'EVALUATION_NOTE',
      signalValue: { note, source: 'recruiting-store' },
      createdAt: now,
    });
  }
  const competitors = (recruiting as { competitors?: Array<{ school?: string; score?: number; source?: string }> })
    .competitors;
  for (const c of competitors ?? []) {
    if (!c?.school || isFloridaSchool(c.school)) continue;
    const pct = Number(c.score);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    signals.push({
      id: `${playerId}-on3-${String(c.school).toLowerCase().replace(/\s+/g, '-')}`,
      playerId,
      signalType: 'OFFER',
      signalValue: {
        school: c.school,
        interestPct: Math.round(pct * 10) / 10,
        source: c.source ?? 'on3',
      },
      createdAt: now,
    });
  }
  return signals;
}

export function futurecastPicksFromRecruiting(
  playerId: string,
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>
): Array<{ school: string; score: number }> {
  if (!recruiting) return [];
  const picks: Array<{ school: string; score: number; id: string }> = [];
  const ufCommit = isFloridaSchool(recruiting.committedTo);
  const ufPct = ufCommit ? 100 : parseUfPct(recruiting.ufProbability ?? recruiting.ufRpmPct);
  if (ufPct > 0) {
    picks.push({ id: `${playerId}-pick-florida`, school: 'Florida', score: ufPct });
  }
  const competitors = (recruiting as { competitors?: Array<{ school?: string; score?: number }> })
    .competitors;
  for (const c of competitors ?? []) {
    if (!c?.school || isFloridaSchool(c.school)) continue;
    const score = Number(c.score);
    if (!Number.isFinite(score) || score <= 0) continue;
    picks.push({
      id: `${playerId}-pick-${String(c.school).toLowerCase().replace(/\s+/g, '-')}`,
      school: String(c.school),
      score: Math.round(score * 10) / 10,
    });
  }
  return picks
    .sort((a, b) => b.score - a.score)
    .map(({ school, score }) => ({ school, score }));
}

export function futurecastSummaryForRecruiting(
  player: Record<string, unknown>,
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>,
  existing: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (existing) return existing;
  if (!recruiting) return null;
  const ufCommit = isFloridaSchool(recruiting.committedTo);
  const pct = parseUfPct(recruiting.ufProbability ?? recruiting.ufRpmPct);
  const competitors = (recruiting as { competitors?: Array<{ school?: string; score?: number }> })
    .competitors;
  const hasBoard = Array.isArray(competitors) && competitors.some((c) => c?.school && Number(c.score) > 0);
  const topPeer = (competitors ?? [])
    .filter((c) => c?.school && !isFloridaSchool(c.school) && Number(c.score) > 0)
    .sort((a, b) => Number(b.score) - Number(a.score))[0];

  if (ufCommit) {
    return {
      ufProbability: 100,
      predictedSchool: 'Florida',
      movementDelta: null,
      fitScore: player.ufFitScore ?? 100,
      volatilityScore: 0,
    };
  }
  if (pct > 0 || hasBoard) {
    return {
      ufProbability: pct > 0 ? pct : null,
      predictedSchool: topPeer?.school ? String(topPeer.school) : null,
      movementDelta: null,
      fitScore: player.ufFitScore ?? recruiting.fitScore ?? null,
      volatilityScore: 0,
    };
  }
  return null;
}
