'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadSession } from '@/lib/auth-api';
import {
  fetchSubscriptionCatalog,
  fetchSubscriptionStatus,
  type SubscriptionCatalog,
  type SubscriptionStatus,
} from '@/lib/subscription-api';
import '@/lib/membership.css';

function statusBadge(status: SubscriptionStatus | null): React.ReactElement {
  if (!status) return <span className="gv-membership__badge">Loading…</span>;
  if (status.paid) {
    return <span className="gv-membership__badge is-active">Paid · Active</span>;
  }
  if (status.trial.expired) {
    return <span className="gv-membership__badge is-warning">Trial ended</span>;
  }
  return <span className="gv-membership__badge">Free trial</span>;
}

export function AccountMembershipPage(): React.ReactElement {
  const [catalog, setCatalog] = useState<SubscriptionCatalog | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = loadSession();
    if (!session?.token) {
      window.location.replace('/join/?next=/vault/membership/');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [cat, st] = await Promise.all([
          fetchSubscriptionCatalog(),
          fetchSubscriptionStatus(),
        ]);
        if (cancelled) return;
        setCatalog(cat);
        setStatus(st);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load membership.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="gv-membership" data-testid="vault-membership">
        <p className="gv-membership__loading">Loading membership…</p>
      </div>
    );
  }

  return (
    <div className="gv-membership" data-testid="vault-membership">
      <h1 className="gv-membership__title">Membership</h1>
      <p className="gv-membership__sub">
        Manage your Insider tier, trial, and billing. iOS app subscriptions are managed through the App Store.
      </p>

      {error ? <p className="gv-membership__error">{error}</p> : null}

      {status ? (
        <section className="gv-membership__status" aria-label="Current membership">
          <div className="gv-membership__status-row">
            {statusBadge(status)}
            <span className="gv-membership__badge">{status.tier.toUpperCase()} tier</span>
          </div>
          <p className="gv-membership__meta">
            {status.paid
              ? 'Your paid membership is active.'
              : status.trial.expired
                ? 'Your 30-day trial has ended. Subscribe to restore full Vault access.'
                : status.trial.daysLeft != null
                  ? `${status.trial.daysLeft} day${status.trial.daysLeft === 1 ? '' : 's'} left in your free trial${
                      status.trial.trialEndFormatted ? ` (ends ${status.trial.trialEndFormatted})` : ''
                    }.`
                  : 'Trial status unavailable.'}
          </p>
          {status.subscription?.source ? (
            <p className="gv-membership__meta">
              Billing source: {status.subscription.source}
              {status.subscription.productId ? ` · ${status.subscription.productId}` : ''}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="gv-membership__cards" aria-label="Available plans">
        {(catalog?.tiers || []).map((tier) => (
          <article
            key={tier.id}
            className={`gv-membership__card${status?.tier === tier.id ? ' is-current' : ''}`}
          >
            <div className="gv-membership__card-head">
              <h2 className="gv-membership__card-name">
                {tier.icon} {tier.name}
                {tier.popular ? ' · Popular' : ''}
              </h2>
              <p className="gv-membership__card-price">${tier.monthlyUsd.toFixed(2)}/mo</p>
            </div>
            <p className="gv-membership__card-note">
              App Store: {tier.products.monthly}
              {status?.tier === tier.id ? ' · Your current tier' : ''}
            </p>
          </article>
        ))}
      </section>

      <section className="gv-membership__cta">
        <p>
          {catalog?.iosPurchaseReady
            ? 'Subscribe in the GatorVault iOS app. Purchases are processed by Apple.'
            : 'iOS in-app purchase is coming soon (Step 3b). Until then, contact support if you need billing help.'}
        </p>
        <p>
          Questions:{' '}
          <a href={`mailto:${status?.billing.supportEmail || 'support@gatorvaultinsider.com'}`}>
            {status?.billing.supportEmail || 'support@gatorvaultinsider.com'}
          </a>
          {' · '}
          <Link href="/terms/">Terms</Link>
          {' · '}
          <Link href="/privacy/">Privacy</Link>
        </p>
      </section>
    </div>
  );
}
