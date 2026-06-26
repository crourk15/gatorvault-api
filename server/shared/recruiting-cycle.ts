/**
 * Recruiting / transfer portal cycle — UTC calendar for seasonal UI.
 * Keep client/lib/recruiting-cycle.ts in sync when changing windows.
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

/** NCAA-style portal windows + football-season offseason for FutureCast UI. */
export function getPortalSeasonState(at: Date = new Date()): PortalSeasonState {
  const { year, month, day } = utcParts(at);

  if (month === 12 || (month === 1 && day <= 15)) {
    return {
      active: true,
      phase: 'portal-winter',
      label: 'Winter transfer portal',
      nextWindowStart: null,
    };
  }

  if ((month === 4 && day >= 15) || (month === 5 && day <= 1)) {
    return {
      active: true,
      phase: 'portal-spring',
      label: 'Spring transfer portal',
      nextWindowStart: null,
    };
  }

  if (month === 11 && day >= 15) {
    return {
      active: false,
      phase: 'portal-prep',
      label: 'Portal intel opens December 1',
      nextWindowStart: `${year}-12-01`,
    };
  }

  if (month >= 8 && month <= 10) {
    return {
      active: false,
      phase: 'football-season',
      label: 'Portal intel resumes December — tracking 2027 board and 2028 discovery',
      nextWindowStart: `${year}-12-01`,
    };
  }

  if (month === 11 && day < 15) {
    return {
      active: false,
      phase: 'football-season',
      label: 'Portal intel resumes December — tracking 2027 board and 2028 discovery',
      nextWindowStart: `${year}-12-01`,
    };
  }

  if ((month === 1 && day > 15) || month === 2 || month === 3 || (month === 4 && day < 15)) {
    return {
      active: false,
      phase: 'signing-season',
      label: 'Spring portal opens mid-April',
      nextWindowStart: `${year}-04-15`,
    };
  }

  return {
    active: false,
    phase: 'offseason',
    label: 'Portal intel resumes December',
    nextWindowStart: `${year}-12-01`,
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

/** Primary board class during portal dormancy vs active portal windows. */
export function primaryRecruitingClassYear(at: Date = new Date()): number {
  const state = getPortalSeasonState(at);
  return shouldShowPortalWatchlist(state) ? 2027 : 2028;
}

/** Skip portal-intel cron/ops when the transfer window is closed. */
export function shouldRunPortalIntelJob(at: Date = new Date()): boolean {
  return getPortalSeasonState(at).active;
}
