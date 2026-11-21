/**
 * Recruiting cycle: class years, signing calendar, portal seasonality.
 */

export const ACTIVE_RECRUITING_CLASS_YEAR = 2027;

export const RECRUITING_CLASS_YEARS = [2026, 2027, 2028] as const;

export type RecruitingClassYear = (typeof RECRUITING_CLASS_YEARS)[number];

export function isRecruitingClassYear(year: number): year is RecruitingClassYear {
  return (RECRUITING_CLASS_YEARS as readonly number[]).includes(year);
}

export function parseRecruitingClassYear(
  value: unknown,
  fallback: RecruitingClassYear = ACTIVE_RECRUITING_CLASS_YEAR
): RecruitingClassYear {
  const year = parseInt(String(value ?? ''), 10);
  return isRecruitingClassYear(year) ? year : fallback;
}

/** HS signing-class metric label — portal tracked separately. */
export function classCommitMetricLabel(
  classYear: number,
  now: Date = new Date()
): 'Signees' | 'Commits' {
  return classYear <= now.getFullYear() ? 'Signees' : 'Commits';
}

export function classCommitLinkLabel(
  classYear: number,
  now: Date = new Date()
): string {
  return classYear <= now.getFullYear() ? 'View signees →' : 'View commits →';
}

export type SigningCalendar = {
  classYear: number;
  esp: {
    start: Date;
    end: Date;
    dateLabel: string;
  };
  nsd: {
    start: Date;
    end: Date;
    dateLabel: string;
  };
};

function calendarDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatMonthDayYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** First Wednesday in February — NCAA National Signing Day. */
export function getNationalSigningDay(classYear: number): Date {
  const year = parseInt(String(classYear), 10);
  const feb1 = calendarDate(year, 2, 1);
  const weekday = feb1.getDay();
  const offset = (3 - weekday + 7) % 7;
  return calendarDate(year, 2, 1 + offset);
}

/** Early Signing Period — Dec 15–17 before the class year. */
export function getEarlySigningPeriod(classYear: number): {
  start: Date;
  end: Date;
  dateLabel: string;
} {
  const year = parseInt(String(classYear), 10);
  const calendarYear = year - 1;
  const start = calendarDate(calendarYear, 12, 15);
  const end = calendarDate(calendarYear, 12, 18);
  return {
    start,
    end,
    dateLabel: `December 15–17, ${calendarYear}`,
  };
}

export function getSigningCalendar(classYear = ACTIVE_RECRUITING_CLASS_YEAR): SigningCalendar {
  const year = parseInt(String(classYear), 10);
  const esp = getEarlySigningPeriod(year);
  const nsdDay = getNationalSigningDay(year);
  const nsdStart = calendarDate(nsdDay.getFullYear(), nsdDay.getMonth() + 1, nsdDay.getDate());
  const nsdEnd = calendarDate(nsdDay.getFullYear(), nsdDay.getMonth() + 1, nsdDay.getDate() + 1);

  return {
    classYear: year,
    esp,
    nsd: {
      start: nsdStart,
      end: nsdEnd,
      dateLabel: formatMonthDayYear(nsdDay),
    },
  };
}

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

export function isFootballSeason(at: Date = new Date()): boolean {
  const phase = getPortalSeasonState(at).phase;
  return phase === 'football-season' || phase === 'portal-prep';
}

export function primaryRecruitingClassYear(at: Date = new Date()): number {
  const state = getPortalSeasonState(at);
  return shouldShowPortalWatchlist(state) ? 2027 : 2028;
}

export function shouldRunPortalIntelJob(at: Date = new Date()): boolean {
  return getPortalSeasonState(at).active;
}
