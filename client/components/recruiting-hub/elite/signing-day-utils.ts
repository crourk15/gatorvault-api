import {
  ACTIVE_RECRUITING_CLASS_YEAR,
  getSigningCalendar,
  type SigningCalendar,
} from '@/lib/recruiting-cycle';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import {
  isActiveUfTarget,
  isFloridaSchool,
  resolveCommittedTo,
} from '@/lib/recruiting-target-filters';

export type SigningEventId = 'esp' | 'nsd';

export type SigningEventConfig = {
  id: SigningEventId;
  label: string;
  shortLabel: string;
  badge: string;
  liveBadge: string;
  linkLabel: string;
  linkHref: string;
  classYear: number;
  start: Date;
  end: Date;
  dateLabel: string;
};

export type SigningCountdown = {
  isLive: boolean;
  isPast: boolean;
  days: number;
  hours: number;
  targetLabel: string;
};

function buildSigningEventConfig(
  calendar: SigningCalendar,
  id: SigningEventId
): SigningEventConfig {
  if (id === 'esp') {
    return {
      id,
      label: 'Early Signing Period (ESP)',
      shortLabel: 'Early Signing Period',
      badge: 'Primary Signing Window',
      liveBadge: 'LIVE SIGNING WINDOW',
      linkLabel: 'Expected signees →',
      linkHref: `/vault/recruiting/signing/esp?year=${calendar.classYear}`,
      classYear: calendar.classYear,
      start: calendar.esp.start,
      end: calendar.esp.end,
      dateLabel: calendar.esp.dateLabel,
    };
  }

  return {
    id,
    label: 'National Signing Day (NSD)',
    shortLabel: 'National Signing Day',
    badge: 'Then the closer',
    liveBadge: 'LIVE SIGNING WINDOW',
    linkLabel: 'Remaining targets →',
    linkHref: `/vault/recruiting/signing/nsd?year=${calendar.classYear}`,
    classYear: calendar.classYear,
    start: calendar.nsd.start,
    end: calendar.nsd.end,
    dateLabel: calendar.nsd.dateLabel,
  };
}

/** Signing windows for the active recruiting cycle (defaults to class of 2027). */
export function getSigningEvents(
  classYear = ACTIVE_RECRUITING_CLASS_YEAR
): Record<SigningEventId, SigningEventConfig> {
  const calendar = getSigningCalendar(classYear);
  return {
    esp: buildSigningEventConfig(calendar, 'esp'),
    nsd: buildSigningEventConfig(calendar, 'nsd'),
  };
}

/** @deprecated use getSigningEvents() — kept for callers that expect a static object. */
export const SIGNING_EVENTS = getSigningEvents();

export function getSigningCountdown(event: SigningEventConfig, now = new Date()): SigningCountdown {
  const { start, end } = event;
  const isLive = now >= start && now < end;
  const isPast = now >= end;

  let target: Date;
  let targetLabel: string;

  if (isPast) {
    return { isLive: false, isPast: true, days: 0, hours: 0, targetLabel: 'Window closed' };
  }

  if (isLive) {
    target = end;
    targetLabel = 'Window closes in';
  } else {
    target = start;
    targetLabel = 'Opens in';
  }

  const ms = Math.max(0, target.getTime() - now.getTime());
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return { isLive, isPast, days, hours, targetLabel };
}

export type SigningBoardLists = {
  commits?: RecruitingBoardPlayer[] | null;
  targets?: RecruitingBoardPlayer[] | null;
};

function isUfCommit(player: RecruitingBoardPlayer): boolean {
  if (player.isCommittedToUF) return true;
  return isFloridaSchool(resolveCommittedTo(player));
}

function matchesClassYear(
  player: RecruitingBoardPlayer,
  classYear?: number | null
): boolean {
  if (classYear == null || !Number.isFinite(Number(classYear))) return true;
  const y = Number(player.classYear);
  if (!Number.isFinite(y)) return true; // year-scoped board fetch is authoritative
  return y === Number(classYear);
}

/**
 * ESP "Expected signees" = Florida commits for that class year.
 * Never Flip Watch / committed-elsewhere TOP-HIGH targets.
 * NSD "Remaining targets" = open UF hunts for that class only.
 */
export function selectSigningBoardPlayers(
  eventId: SigningEventId,
  board: SigningBoardLists,
  classYear?: number | null
): RecruitingBoardPlayer[] {
  const commits = (board.commits ?? []).filter((p) => matchesClassYear(p, classYear));
  const targets = (board.targets ?? []).filter((p) => matchesClassYear(p, classYear));

  const pool =
    eventId === 'esp'
      ? commits.filter(isUfCommit)
      : targets.filter((p) => isActiveUfTarget(p));

  return [...pool].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    return Number(ra) - Number(rb);
  });
}
