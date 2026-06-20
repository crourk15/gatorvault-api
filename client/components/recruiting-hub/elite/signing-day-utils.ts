export type SigningEventId = 'esp' | 'nsd';

export type SigningEventConfig = {
  id: SigningEventId;
  label: string;
  badge: string;
  liveBadge: string;
  linkLabel: string;
  linkHref: string;
  start: Date;
  end: Date;
  dateLabel: string;
};

export const SIGNING_EVENTS: Record<SigningEventId, SigningEventConfig> = {
  esp: {
    id: 'esp',
    label: 'Early Signing Period (ESP)',
    badge: 'Primary Signing Window',
    liveBadge: 'LIVE SIGNING WINDOW',
    linkLabel: 'Expected signees →',
    linkHref: '/vault/recruiting/signing/esp',
    start: new Date('2026-12-16T00:00:00'),
    end: new Date('2026-12-19T00:00:00'),
    dateLabel: 'December 16–18, 2026',
  },
  nsd: {
    id: 'nsd',
    label: 'National Signing Day (NSD)',
    badge: 'Final Signatures',
    liveBadge: 'LIVE SIGNING WINDOW',
    linkLabel: 'Remaining targets →',
    linkHref: '/vault/recruiting/signing/nsd',
    start: new Date('2026-02-04T00:00:00'),
    end: new Date('2026-02-05T00:00:00'),
    dateLabel: 'February 4, 2026',
  },
};

export type SigningCountdown = {
  isLive: boolean;
  isPast: boolean;
  days: number;
  hours: number;
  targetLabel: string;
};

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
