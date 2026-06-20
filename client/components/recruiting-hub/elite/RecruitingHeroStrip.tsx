'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubTicker } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';

const FALLBACK_TICKER = [
  '2027 class trending nationally — UF in the mix',
  'Blue chip % rising on the board',
  'Staff locked in for summer evals',
  'Battles heating up — movement intel live',
];

export function RecruitingHeroStrip(): React.ReactElement {
  const loadTicker = useCallback(() => fetchRecruitingHubTicker(), []);
  const { data } = useRecruitingHubQuery(loadTicker);
  const tickerItems = data && data.length > 0 ? data : FALLBACK_TICKER;

  return (
    <section className="rh-hero-strip" aria-label="Recruiting War Room">
      <div className="rh-hero-sweep" aria-hidden="true" />
      <div className="rh-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <div className="rh-hero-top">
        <div>
          <div className="rh-hero-title">Recruiting Command Center</div>
          <div className="rh-hero-subtitle">UF&apos;s class, movement, and battles—one place.</div>
        </div>
        <span className="rh-badge rh-hero-badge rh-hero-badge--pulse">WAR ROOM</span>
      </div>
      <div className="rh-hero-ticker" aria-label="Recruiting intel ticker">
        <div className="rh-hero-ticker-track">
          {tickerItems.map((item, idx) => (
            <span key={idx} className="rh-hero-ticker-item">
              {item}
              <span className="rh-hero-ticker-sep">·</span>
            </span>
          ))}
          {tickerItems.map((item, idx) => (
            <span key={`dup-${idx}`} className="rh-hero-ticker-item">
              {item}
              <span className="rh-hero-ticker-sep">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
