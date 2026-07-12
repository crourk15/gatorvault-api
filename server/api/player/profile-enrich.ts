/**
 * Recruiting-store enrichment for aggregated player profiles.
 */
import { createRequire } from 'node:module';
import { getRecruitingPlayerBySlug } from '../players/recruiting-fallback';

const require = createRequire(import.meta.url);
const { isPlaceholderSchool, formatRecruitSchoolLabel } = require('../../lib/recruiting-placeholder-school');
const offerLogStore = require('../../lib/recruiting-offer-log-store');

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
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum >= 48 && asNum <= 96) return asNum;
  const m = String(raw).match(/(\d+)\s*[-']\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return parseInt(m[1], 10) * 12 + Number(m[2]);
}

function parseHtWt(htWt?: string | null): { height: number | null; weight: number | null } {
  const raw = String(htWt || '');
  const m = raw.match(/(\d+\s*[-']\s*\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
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

  const schoolRaw =
    recruiting.school ?? recruiting.highSchool ?? player.highSchool ?? null;
  const schoolLabel = isPlaceholderSchool(schoolRaw)
    ? null
    : formatRecruitSchoolLabel(schoolRaw) || null;

  return {
    ...player,
    fullName: player.fullName ?? recruiting.name ?? player.slug,
    highSchool: player.highSchool && !isPlaceholderSchool(player.highSchool)
      ? player.highSchool
      : schoolLabel,
    hometown:
      player.hometown ??
      recruiting.hometown ??
      (recruiting.hometownCity
        ? [recruiting.hometownCity, recruiting.hometownState || recruiting.state]
            .filter(Boolean)
            .join(', ')
        : null),
    state: player.state ?? recruiting.state ?? recruiting.hometownState ?? null,
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
  const asOf = String(recruiting.updatedAt || '').trim() || null;
  const signals: Record<string, unknown>[] = [];
  const note = String(recruiting.profileNote ?? recruiting.skinny ?? '').trim();
  if (note) {
    signals.push({
      id: `${playerId}-staff-note`,
      playerId,
      signalType: 'EVALUATION_NOTE',
      signalValue: { note, source: 'recruiting-store' },
      createdAt: asOf,
    });
  }
  // On3 competitor RPM belongs on the Prediction Market board, not the signal feed.
  return signals;
}

/** Real offer rows from offer_logs.json (dated). */
export function offerSignalsFromOfferLogs(
  playerId: string,
  slug: string
): Record<string, unknown>[] {
  const logs = offerLogStore.listOfferLogs({ playerSlug: slug, limit: 25 }) || [];
  return logs.map((log: {
    id?: string;
    school?: string;
    date?: string;
    reportedAt?: string;
    source?: string;
    offerType?: string;
  }, i: number) => {
    const when = log.date || log.reportedAt || null;
    return {
      id: log.id || `${playerId}-offer-log-${i}`,
      playerId,
      signalType: 'OFFER',
      signalValue: {
        school: log.school || 'Unknown',
        source: log.source || 'offer-log',
        offerType: log.offerType || 'offer',
      },
      createdAt: when,
    };
  });
}

export function mergeProfileSignals(
  primary: Record<string, unknown>[] = [],
  ...extras: Record<string, unknown>[][]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const list of [primary, ...extras]) {
    for (const signal of list || []) {
      const type = String(signal.signalType || '');
      const value = (signal.signalValue as Record<string, unknown>) || {};
      const school = String(value.school || '').toLowerCase();
      const day = String(signal.createdAt || '').slice(0, 10);
      const key = `${type}|${school}|${day}|${String(value.note || '').slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(signal);
    }
  }
  return out;
}

/** Offers for High School tab — dated from offer logs + player.offers. */
export function offersFromRecruitingAndLogs(
  slug: string,
  recruiting: Awaited<ReturnType<typeof getRecruitingPlayerBySlug>>
): Array<{ school: string | null; date: string | null }> {
  const fromLogs = (offerLogStore.listOfferLogs({ playerSlug: slug, limit: 40 }) || []).map(
    (log: { school?: string; date?: string; reportedAt?: string }) => ({
      school: log.school || null,
      date: log.date || log.reportedAt || null,
    })
  );
  const fromPlayer = ((recruiting as { offers?: Array<{ school?: string; date?: string }> })?.offers || [])
    .filter((o) => o?.school)
    .map((o) => ({ school: o.school || null, date: o.date || null }));
  const seen = new Set<string>();
  const out: Array<{ school: string | null; date: string | null }> = [];
  for (const row of [...fromLogs, ...fromPlayer]) {
    const key = `${String(row.school || '').toLowerCase()}|${String(row.date || '').slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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
