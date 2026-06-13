'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchFutureCastHome, type FutureCastHomeResponse } from '@/lib/futurecast-home-api';
import { LANDING_FEATURES, PRICING_TIERS } from '@/lib/pricing-tiers';

function FutureCastPreview(): React.ReactElement {
  const [data, setData] = useState<FutureCastHomeResponse | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchFutureCastHome('fit'));
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buckets = data?.heatmap?.buckets ?? [];
  const up = buckets.find((b) => /up/i.test(b.label))?.count ?? '—';
  const down = buckets.find((b) => /down/i.test(b.label))?.count ?? '—';
  const flat = buckets.find((b) => /flat/i.test(b.label))?.count ?? '—';
  const topTarget = data?.topTargets?.[0];
  const latestCommit = data?.commits?.[0];
  const portalPick = data?.portalWatchlist?.[0];

  return (
    <a href="/futurecast" className="gv-landing-fc-preview">
      <div className="gv-landing-fc-preview__head">
        <h3>Live Preview</h3>
        <span>Movement · Targets · Portal</span>
      </div>
      <div className="gv-landing-fc-preview__heat">
        <div>
          <p>Up</p>
          <strong>{up}</strong>
        </div>
        <div>
          <p>Down</p>
          <strong>{down}</strong>
        </div>
        <div>
          <p>Flat</p>
          <strong>{flat}</strong>
        </div>
      </div>
      <div className="gv-landing-fc-preview__panels">
        <div>
          <h4>Top Target</h4>
          <p>{topTarget?.fullName ?? 'Loading…'}</p>
        </div>
        <div>
          <h4>Latest Commit</h4>
          <p>{latestCommit?.fullName ?? '—'}</p>
        </div>
        <div>
          <h4>Portal Watch</h4>
          <p>{portalPick?.fullName ?? '—'}</p>
        </div>
      </div>
      <p className="gv-landing-fc-preview__foot">Tap to open FutureCast →</p>
    </a>
  );
}

export function LandingPage(): React.ReactElement {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="gv-landing" data-testid="landing-page">
      <section className="gv-landing-hero">
        <div className="gv-landing-hero__glow" aria-hidden="true" />
        <div className="gv-landing-hero__inner">
          <span className="gv-landing-hero__badge">
            <span className="gv-landing-pulse" aria-hidden="true" />
            Beta — Charter Memberships Now Open
          </span>
          <h1 className="gv-landing-hero__title">
            Your Full <span>UF Football Hub.</span>
          </h1>
          <p className="gv-landing-hero__sub">
            Depth charts, recruiting, transfer portal, film room, live feed, and game week — all in
            one place for passionate Gator fans.
          </p>
          <p className="gv-landing-hero__trial">🎟️ Try FREE for 30 days · No credit card required</p>
          <div className="gv-landing-hero__actions">
            <a href="/join?tier=film" className="gv-landing-btn gv-landing-btn--primary">
              🔐 Start Free — No Card Required
            </a>
            <a href="/futurecast" className="gv-landing-btn gv-landing-btn--blue">
              📈 Open FutureCast
            </a>
            <a href="/vault" className="gv-landing-btn gv-landing-btn--outline">
              See What&apos;s Inside
            </a>
          </div>
          <p className="gv-landing-hero__footnote">
            🏅 Founding Member badge for charter subscribers · First 100 only
          </p>
        </div>
      </section>

      <section className="gv-landing-section gv-landing-fc">
        <div className="gv-landing-section__inner gv-landing-fc__grid">
          <div>
            <span className="gv-landing-hero__badge">Flagship Feature · 2027 Cycle</span>
            <h2 className="gv-landing-section__title">
              FutureCast — <em>Florida Recruiting Intelligence</em>
            </h2>
            <p className="gv-landing-section__sub">
              Live recruiting predictions, movement tracking, portal intel, and class analytics for
              the Florida Gators.
            </p>
            <a href="/futurecast" className="gv-landing-link">
              Open FutureCast →
            </a>
          </div>
          <FutureCastPreview />
        </div>
      </section>

      <section className="gv-landing-section gv-landing-section--dark">
        <div className="gv-landing-section__inner">
          <div className="gv-landing-section__head">
            <h2 className="gv-landing-section__title">
              Everything Gator Nation <span>Needs</span>
            </h2>
            <p className="gv-landing-section__sub">One platform. Every angle. Total Gator football coverage.</p>
          </div>
          <div className="gv-landing-features">
            {LANDING_FEATURES.map((f) => (
              <a key={f.title} href={f.href} className="gv-landing-feature">
                <span className="gv-landing-feature__icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="gv-landing-section">
        <div className="gv-landing-section__inner">
          <div className="gv-landing-section__head">
            <h2 className="gv-landing-section__title">
              Choose Your <span>Access Level</span>
            </h2>
            <p className="gv-landing-section__sub">
              Start with a 30-day free trial. No credit card required.
            </p>
            <div className="gv-landing-price-toggle">
              <button
                type="button"
                className={!annual ? 'is-active' : ''}
                onClick={() => setAnnual(false)}
              >
                Monthly
              </button>
              <button type="button" className={annual ? 'is-active' : ''} onClick={() => setAnnual(true)}>
                Annual <span>Save 20%</span>
              </button>
            </div>
          </div>
          <p className="gv-landing-trial-banner">
            🎟️ FREE 30-DAY TRIAL — NO CARD REQUIRED
          </p>
          <div className="gv-landing-pricing">
            {PRICING_TIERS.map((tier) => (
              <article
                key={tier.id}
                className={`gv-landing-price-card${tier.popular ? ' is-popular' : ''}`}
              >
                {tier.popular ? <span className="gv-landing-price-card__badge">Most Popular</span> : null}
                <h3>
                  {tier.icon} {tier.name}
                </h3>
                <p className="gv-landing-price-card__amount">
                  ${annual ? tier.annual.toFixed(2) : tier.monthly.toFixed(2)}
                  <span>/month</span>
                </p>
                <ul>
                  {tier.features.map((feat) => (
                    <li key={feat}>{feat}</li>
                  ))}
                </ul>
                <a href={`/join?tier=${tier.id}`} className="gv-landing-btn gv-landing-btn--block">
                  Start Free — No Card Required
                </a>
              </article>
            ))}
          </div>
          <p className="gv-landing-pricing-note">
            No credit card required to start. Payment only on Day 31 if you choose to continue.
          </p>
        </div>
      </section>

      <footer className="gv-landing-footer">
        <p>🐊 GatorVault Insider · Built for Gator Nation</p>
        <p>
          <a href="/join">Join</a> · <a href="/vault">Enter the Vault</a> ·{' '}
          <a href="/futurecast">FutureCast</a>
        </p>
      </footer>
    </div>
  );
}
