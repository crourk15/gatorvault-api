import { formatRecruitSchoolLabel } from './recruiting-display-utils';

/**
 * Younger Prospects — 2029 / 2030 watchboard helpers.
 * Group by class year (no interleaved soup). Cap each stack. Hide filler metrics.
 */

export const YOUNGER_PROSPECT_YEARS = [2029, 2030] as const;

/** Hub mini grids — keep each class short. */
export const YOUNGER_PROSPECT_HUB_CAPS: Record<number, number> = {
  2029: 10,
  2030: 6,
};

/** Lab denser lists — Power Top 100 FL + tracked early targets. */
export const YOUNGER_PROSPECT_LAB_CAPS: Record<number, number> = {
  2029: 12,
  2030: 6,
};

export function sortWithinYoungerYear<
  T extends {
    classYear?: number | null;
    discoveryScore?: number | null;
    ufConfidence?: number | null;
    ufProbability?: number | null;
    natlRank?: number | null;
    name?: string | null;
    position?: string | null;
  },
>(a: T, b: T): number {
  const athRank = (p: T) => {
    const pos = String(p.position || '')
      .trim()
      .toUpperCase();
    return !pos || pos === 'TBD' || pos === 'ATH' ? 1 : 0;
  };
  const athDiff = athRank(a) - athRank(b);
  if (athDiff !== 0) return athDiff;
  const discDiff = Number(b.discoveryScore ?? 0) - Number(a.discoveryScore ?? 0);
  if (discDiff !== 0) return discDiff;
  const ufA = Number(a.ufProbability ?? a.ufConfidence) || 0;
  const ufB = Number(b.ufProbability ?? b.ufConfidence) || 0;
  if (ufB !== ufA) return ufB - ufA;
  const na = a.natlRank ?? 9999;
  const nb = b.natlRank ?? 9999;
  if (na !== nb) return na - nb;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

export type YoungerProspectYearGroup<T> = {
  year: number;
  players: T[];
  total: number;
  label: string;
  badge: string;
};

function yearBadge(year: number): string {
  return year >= 2030 ? 'Early watch' : 'Early target';
}

/**
 * Identical mid-band UF≈Fit (e.g. 48/48) is seed noise for early cycles — hide it.
 */
export function isFillerUfFitPair(
  uf: number | null | undefined,
  fit: number | null | undefined
): boolean {
  if (uf == null || fit == null) return false;
  const u = Math.round(Number(uf));
  const f = Math.round(Number(fit));
  if (!Number.isFinite(u) || !Number.isFinite(f)) return false;
  return u === f && u >= 40 && u <= 55;
}

/** Real UF % for younger display — RPM first; hide thin/filler estimates. */
export function youngerProspectUfPct(p: {
  ufConfidence?: number | null;
  ufRpmPct?: number | null;
  ufProbabilityLowConfidence?: boolean | null;
  ufProbabilitySource?: string | null;
  fitScore?: number | null;
}): number | null {
  const rpm = p.ufRpmPct != null ? Number(p.ufRpmPct) : NaN;
  if (Number.isFinite(rpm) && rpm > 0) return Math.round(rpm);

  if (p.ufProbabilityLowConfidence) return null;
  const src = String(p.ufProbabilitySource || '').toLowerCase();
  if (src === 'estimate' || src === 'unknown') return null;
  if (isFillerUfFitPair(p.ufConfidence, p.fitScore)) return null;

  const uf = p.ufConfidence != null ? Number(p.ufConfidence) : NaN;
  if (!Number.isFinite(uf) || uf <= 0) return null;
  return Math.round(uf);
}

/** Real fit % — hide when missing or paired filler with UF. */
export function youngerProspectFitPct(p: {
  ufConfidence?: number | null;
  fitScore?: number | null;
}): number | null {
  const fit = p.fitScore != null ? Number(p.fitScore) : NaN;
  if (!Number.isFinite(fit) || fit <= 0) return null;
  if (isFillerUfFitPair(p.ufConfidence, p.fitScore)) return null;
  return Math.round(fit);
}

export function youngerProspectStars(stars: number | null | undefined): number | null {
  const n = Number(stars);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function youngerProspectTierLabel(
  p: { tier?: string | null; classYear?: number | null },
  year?: number
): string {
  const y = (year ?? Number(p.classYear)) || 0;
  if (y >= 2030 || p.tier === 'watchlist') return 'Watch';
  return 'Early target';
}

/** Lab gate — need a real school line. */
export function isLabYoungerProspect(p: {
  school?: string | null;
  state?: string | null;
}): boolean {
  const school = formatRecruitSchoolLabel(p.school, p.state);
  return Boolean(school) && school !== 'School pending';
}

/**
 * Fan Lab meta — school + stars only.
 * No UF%/Δ/vs Florida theater on early classes.
 */
export function formatYoungerLabMeta(p: {
  school?: string | null;
  state?: string | null;
  stars?: number | null;
  natlRank?: number | null;
  rivalsNatlRank?: number | null;
}): string {
  const parts: string[] = [];
  const school = formatRecruitSchoolLabel(p.school, p.state);
  if (school && school !== 'School pending') parts.push(school);
  const stars = youngerProspectStars(p.stars);
  if (stars != null) parts.push(`${stars}★`);
  const natl = Number(p.natlRank ?? p.rivalsNatlRank);
  if (Number.isFinite(natl) && natl > 0) parts.push(`#${Math.round(natl)}`);
  return parts.join(' · ');
}

/** Bucket + sort + per-year cap. Empty years are omitted. */
export function groupYoungerProspectsByYear<T extends { classYear?: number | null }>(
  players: T[],
  years: readonly number[] = YOUNGER_PROSPECT_YEARS,
  caps: Record<number, number> = YOUNGER_PROSPECT_HUB_CAPS
): YoungerProspectYearGroup<T>[] {
  return years
    .map((year) => {
      const all = players
        .filter((p) => Number(p.classYear) === year)
        .sort(sortWithinYoungerYear);
      const cap = caps[year] ?? 8;
      return {
        year,
        players: all.slice(0, cap),
        total: all.length,
        label: `Class of ${year}`,
        badge: yearBadge(year),
      };
    })
    .filter((g) => g.total > 0);
}

/** True when more than half of shown players are ATH/TBD/blank (positions not filled in). */
export function isAthHeavyShownPlayers(
  players: Array<{ position?: string | null }>
): boolean {
  if (players.length === 0) return false;
  const athCount = players.filter((p) => {
    const pos = String(p.position || '')
      .trim()
      .toUpperCase();
    return !pos || pos === 'TBD' || pos === 'ATH';
  }).length;
  return athCount / players.length > 0.5;
}

/** @deprecated Prefer groupYoungerProspectsByYear — kept for any leftover callers. */
export function takeYoungerProspectMix<T extends { classYear?: number | null; slug?: string }>(
  players: T[],
  years: readonly number[] = YOUNGER_PROSPECT_YEARS,
  limit = 12
): T[] {
  const perYear = Math.max(1, Math.ceil(limit / Math.max(1, years.length)));
  const caps = Object.fromEntries(years.map((y) => [y, perYear]));
  return groupYoungerProspectsByYear(players, years, caps).flatMap((g) => g.players).slice(0, limit);
}