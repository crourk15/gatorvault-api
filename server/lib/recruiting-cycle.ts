/**
 * Recruiting / transfer portal cycle — UTC calendar for seasonal UI.
 * Mirror of server/shared/recruiting-cycle.ts
 */

export type PortalCyclePhase =
  | 'portal-winter'
  | 'portal-spring'
  | 'portal-prep'
  | 'football-season'
  | 'signing-season'
  | 'offseason';

export interface PortalSeasonState {
  active: boolean;
  phase: PortalCyclePhase;
  label: string;
  nextWindowStart: string | null;
}

export const PORTAL_UI_MIN_CANDIDATES = 3;

function utcParts(at: Date): { year: number; month: number; day: number } {
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
  };
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * NCAA FBS/FCS: 10-day notification window starting the first business day
 * after January 1. 2026-27 is January 4–13, 2027. No December football window
 * and no spring football window.
 */
export function footballWinterWindow(januaryYear: number): { startYmd: string; endYmd: string } {
  let start = new Date(Date.UTC(januaryYear, 0, 2));
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
    start = addUtcDays(start, 1);
  }
  return { startYmd: ymdUtc(start), endYmd: ymdUtc(addUtcDays(start, 9)) };
}

function formatIsoMonthDayYear(iso: string): string {
  const [y, m, d] = iso.split('-').map((v) => Number.parseInt(v, 10));
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function getPortalSeasonState(at: Date = new Date()): PortalSeasonState {
  const { year, month, day } = utcParts(at);
  const today = ymdUtc(at);
  const thisWin = footballWinterWindow(year);

  if (today >= thisWin.startYmd && today <= thisWin.endYmd) {
    return {
      active: true,
      phase: 'portal-winter',
      label: 'Winter transfer portal',
      nextWindowStart: null,
    };
  }

  const nextWin = today < thisWin.startYmd ? thisWin : footballWinterWindow(year + 1);
  const nextLabel = formatIsoMonthDayYear(nextWin.startYmd);
  const inPrep =
    (month === 11 && day >= 15) ||
    month === 12 ||
    (month === 1 && today < nextWin.startYmd);

  if (inPrep) {
    return {
      active: false,
      phase: 'portal-prep',
      label: `Football portal opens ${nextLabel}`,
      nextWindowStart: nextWin.startYmd,
    };
  }

  if ((month >= 8 && month <= 10) || (month === 11 && day < 15)) {
    return {
      active: false,
      phase: 'football-season',
      label: `Portal intel resumes January — tracking 2027 board and 2028 discovery`,
      nextWindowStart: nextWin.startYmd,
    };
  }

  if (month === 2 || month === 3 || (month === 1 && today > thisWin.endYmd)) {
    return {
      active: false,
      phase: 'signing-season',
      label: `Next football portal ${nextLabel}`,
      nextWindowStart: nextWin.startYmd,
    };
  }

  return {
    active: false,
    phase: 'offseason',
    label: `Portal intel resumes ${nextLabel}`,
    nextWindowStart: nextWin.startYmd,
  };
}

export function shouldShowPortalWatchlist(
  state: PortalSeasonState,
  candidateCount = 0
): boolean {
  if (state.active) return true;
  return candidateCount >= PORTAL_UI_MIN_CANDIDATES;
}

export function portalDormantMessage(state: PortalSeasonState): string {
  return state.label;
}

export function resolvePortalSeason(
  apiSeason?: PortalSeasonState | null,
  candidateCount = 0
): PortalSeasonState & { showUi: boolean } {
  const state = apiSeason ?? getPortalSeasonState();
  return {
    ...state,
    showUi: shouldShowPortalWatchlist(state, candidateCount),
  };
}

export function primaryRecruitingClassYear(at: Date = new Date()): number {
  const state = getPortalSeasonState(at);
  return shouldShowPortalWatchlist(state) ? 2027 : 2028;
}

export function shouldRunPortalIntelJob(at: Date = new Date()): boolean {
  return getPortalSeasonState(at).active;
}
