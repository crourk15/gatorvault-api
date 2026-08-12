'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getSigningEvents,
  getSigningCountdown,
  type SigningEventConfig,
  type SigningCountdown,
} from '@/components/recruiting-hub/elite/signing-day-utils';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

function EspPrimary({
  event,
  countdown,
}: {
  event: SigningEventConfig;
  countdown: SigningCountdown;
}): React.ReactElement {
  return (
    <div
      className={`rh-sign-esp${countdown.isLive ? ' rh-sign-esp--live' : ''}`}
      data-testid={`rh-signing-${event.id}`}
    >
      <p className="rh-sign-esp__role">Primary window</p>
      <h3 className="rh-sign-esp__title">{event.shortLabel || event.label}</h3>
      <p className="rh-sign-esp__dates">{event.dateLabel}</p>
      <div className="rh-sign-esp__row">
        {countdown.isPast ? (
          <p className="rh-sign-esp__closed">Window closed</p>
        ) : (
          <div className="rh-sign-esp__days" aria-live={countdown.isLive ? 'polite' : 'off'}>
            {countdown.days}
            <small>{countdown.isLive ? 'days left' : 'days out'}</small>
          </div>
        )}
        <Link href={event.linkHref} className="rh-sign-esp__link">
          {event.linkLabel}
        </Link>
      </div>
      {countdown.isLive ? (
        <div className="rh-sign-esp__live" aria-label="Live signing updates">
          <span className="rh-sign-esp__live-pulse" aria-hidden="true" />
          Live updates — commits posting as signatures land
        </div>
      ) : null}
    </div>
  );
}

function NsdCloser({
  event,
  countdown,
}: {
  event: SigningEventConfig;
  countdown: SigningCountdown;
}): React.ReactElement {
  return (
    <Link
      href={event.linkHref}
      className={`rh-sign-nsd${countdown.isLive ? ' rh-sign-nsd--live' : ''}`}
      data-testid={`rh-signing-${event.id}`}
    >
      <div>
        <p className="rh-sign-nsd__role">Then the closer</p>
        <p className="rh-sign-nsd__title">{event.shortLabel || event.label}</p>
        <p className="rh-sign-nsd__dates">{event.dateLabel}</p>
      </div>
      <div className="rh-sign-nsd__days">
        {countdown.isPast ? (
          <>
            0<small>done</small>
          </>
        ) : (
          <>
            {countdown.days}
            <small>days</small>
          </>
        )}
      </div>
    </Link>
  );
}

export function SigningDayTracker(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const signingEvents = getSigningEvents(activeYear);
  const espCountdown = getSigningCountdown(signingEvents.esp, now);
  const nsdCountdown = getSigningCountdown(signingEvents.nsd, now);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Signing Day</div>
        <div className="rh-section-subtitle">Class of {activeYear} · ESP leads, NSD closes</div>
      </div>
      <section
        className="rh-card rh-signing-tracker rh-signing-tracker--elite"
        data-testid="rh-signing-day-tracker"
      >
        <EspPrimary event={signingEvents.esp} countdown={espCountdown} />
        <NsdCloser event={signingEvents.nsd} countdown={nsdCountdown} />
      </section>
    </>
  );
}
