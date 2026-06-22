'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getSigningEvents,
  getSigningCountdown,
  type SigningEventConfig,
  type SigningCountdown,
} from '@/components/recruiting-hub/elite/signing-day-utils';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

function SigningEventCard({
  event,
  countdown,
}: {
  event: SigningEventConfig;
  countdown: SigningCountdown;
}): React.ReactElement {
  const liveClass = countdown.isLive ? ' rh-signing-event--live' : '';

  return (
    <article className={`rh-signing-event${liveClass}`} data-testid={`rh-signing-${event.id}`}>
      <div className="rh-signing-event__head">
        <div>
          <h3 className="rh-signing-event__title">{event.label}</h3>
          <p className="rh-signing-event__dates">{event.dateLabel}</p>
        </div>
        <span className={`rh-badge${countdown.isLive ? ' rh-badge--live' : ''}`}>
          {countdown.isLive ? event.liveBadge : event.badge}
        </span>
      </div>

      {countdown.isPast ? (
        <p className="rh-signing-event__countdown rh-signing-event__countdown--past">Window closed</p>
      ) : (
        <div className="rh-signing-event__countdown" aria-live={countdown.isLive ? 'polite' : 'off'}>
          <span className="rh-signing-event__countdown-label">{countdown.targetLabel}</span>
          <span className="rh-signing-event__countdown-value">
            <strong>{countdown.days}</strong>d <strong>{countdown.hours}</strong>h
          </span>
        </div>
      )}

      {countdown.isLive ? (
        <div className="rh-signing-event__live-feed" aria-label="Live signing updates">
          <span className="rh-signing-event__live-pulse" aria-hidden="true" />
          Live updates — commits posting as signatures land
        </div>
      ) : null}

      <Link href={event.linkHref} className="rh-signing-event__link">
        {event.linkLabel}
      </Link>
    </article>
  );
}

export function SigningDayTracker(): React.ReactElement {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const signingEvents = getSigningEvents(ACTIVE_RECRUITING_CLASS_YEAR);
  const espCountdown = getSigningCountdown(signingEvents.esp, now);
  const nsdCountdown = getSigningCountdown(signingEvents.nsd, now);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Signing Day Tracker</div>
        <div className="rh-section-subtitle">
          Class of {ACTIVE_RECRUITING_CLASS_YEAR} · ESP and NSD countdowns
        </div>
      </div>
      <section className="rh-card rh-signing-tracker" data-testid="rh-signing-day-tracker">
        <div className="rh-signing-tracker__grid">
          <SigningEventCard event={signingEvents.esp} countdown={espCountdown} />
          <SigningEventCard event={signingEvents.nsd} countdown={nsdCountdown} />
        </div>
      </section>
    </>
  );
}
