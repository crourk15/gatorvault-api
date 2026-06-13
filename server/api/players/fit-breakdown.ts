/**
 * UF Fit Score breakdown — maps player + UF profile to 0–100 category bars.
 */
import { UF_STATUS_INTEREST } from '../uf-fit/engine';

export interface FitScoreBreakdown {
  scheme: number;
  culture: number;
  staff: number;
  need: number;
  geo: number;
}

export interface FitBreakdownPlayerRow {
  state?: string | null;
  fit_scheme?: number | null;
  fit_culture?: number | null;
  fit_staff?: number | null;
  fit_need?: number | null;
  fit_geo?: number | null;
}

export interface FitBreakdownUfProfile {
  scheme_score?: number | null;
  character_score?: number | null;
  athletic_score?: number | null;
  timeline_score?: number | null;
  uf_status?: string | null;
  uf_fit_score?: number | null;
}

function clamp100(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function geoFitScore(state: string | null | undefined): number {
  if (!state) return 0;
  const s = state.toUpperCase();
  if (s === 'FL') return 100;
  if (['GA', 'AL', 'SC', 'TN', 'MS', 'LA'].includes(s)) return 65;
  return 35;
}

function staffFitScore(ufStatus: string | null | undefined, stored: number | null | undefined): number {
  if (stored != null && stored > 0) return clamp100(stored);
  return clamp100((UF_STATUS_INTEREST[ufStatus ?? ''] ?? 0) * 10);
}

export function buildFitScoreBreakdown(
  player: FitBreakdownPlayerRow,
  uf: FitBreakdownUfProfile | null | undefined
): FitScoreBreakdown | null {
  const scheme = clamp100(uf?.scheme_score ?? player.fit_scheme ?? 0);
  const culture = clamp100(uf?.character_score ?? player.fit_culture ?? 0);
  const staff = staffFitScore(uf?.uf_status, player.fit_staff);
  const need = clamp100(
    uf?.athletic_score ?? uf?.timeline_score ?? player.fit_need ?? 0
  );
  const geo = clamp100(player.fit_geo && player.fit_geo > 0 ? player.fit_geo : geoFitScore(player.state));

  const breakdown = { scheme, culture, staff, need, geo };
  const hasData = Object.values(breakdown).some((v) => v > 0) || uf != null;
  return hasData ? breakdown : null;
}

export function fitScoreBreakdownFromRow(
  row: FitBreakdownPlayerRow & FitBreakdownUfProfile
): FitScoreBreakdown {
  return {
    scheme: clamp100(row.fit_scheme ?? row.scheme_score ?? 0),
    culture: clamp100(row.fit_culture ?? row.character_score ?? 0),
    staff: clamp100(row.fit_staff ?? (UF_STATUS_INTEREST[row.uf_status ?? ''] ?? 0) * 10),
    need: clamp100(row.fit_need ?? row.athletic_score ?? row.timeline_score ?? 0),
    geo: clamp100(row.fit_geo && row.fit_geo > 0 ? row.fit_geo : geoFitScore(row.state)),
  };
}
