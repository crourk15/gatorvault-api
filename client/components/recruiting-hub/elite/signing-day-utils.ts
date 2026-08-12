import {
  ACTIVE_RECRUITING_CLASS_YEAR,
  getSigningCalendar,
  type SigningCalendar,
} from '@/lib/recruiting-cycle';

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
      linkHref: '/vault/recruiting/signing/esp',
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
    linkHref: '/vault/recruiting/signing/nsd',
    classYear: calendar.classYear,
    start: calendar.nsd.start,
    end: calendar.nsd.end,
    dateLabel: calendar.nsd.dateLabel,
  };
}

/** Signing windows for the active recruiting cycle (defaults to class of 2027). */
export function getSigningEvents(classYear = ACTIVE_RECRUITING_CLASS_YEAR): Record<SigningEventId, SigningEventConfig> {
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
