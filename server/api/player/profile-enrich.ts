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

export function futurecastSummaryForRecruiting(
  player: Record<string, unknown>,
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>,
  existing: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (existing) return existing;
  if (!recruiting) return null;
  const ufCommit = isFloridaSchool(recruiting.committedTo);
  const pct = parseUfPct(recruiting.ufProbability ?? recruiting.ufRpmPct);
  if (ufCommit) {
    return {
      ufProbability: 100,
      predictedSchool: 'Florida',
      movementDelta: null,
      fitScore: player.ufFitScore ?? 100,
      volatilityScore: 0,
    };
  }
  if (pct >= 10) {
    return {
      ufProbability: pct,
      predictedSchool: null,
      movementDelta: null,
      fitScore: player.ufFitScore ?? null,
      volatilityScore: 0,
    };
  }
  return null;
}
