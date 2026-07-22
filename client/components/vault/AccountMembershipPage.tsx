'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clearSession, loadSession, replaceAuthLocation, verifyStoredSession } from '@/lib/auth-api';
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';
import {
  fetchSubscriptionCatalog,
  fetchSubscriptionStatus,
  isMembershipTransportError,
  membershipLoadErrorMessage,
  MembershipAuthError,
  verifyApplePurchase,
  restoreApplePurchase,
  startStripeCheckout,
  openStripeBillingPortal,
  type SubscriptionCatalog,
  type SubscriptionStatus,
} from '@/lib/subscription-api';
import {
  appAccountTokenForEmail,
  isIosBillingAvailable,
  openIosSubscriptionManagement,
  purchaseIosSubscription,
  finishIosPurchase,
  restoreIosPurchasesWithSync,
} from '@/lib/ios-iap';
import { AccountDeletePanel } from '@/components/vault/AccountDeletePanel';
import { publicPricingTiers } from '@/lib/pricing-tiers';
import '@/lib/membership.css';

const LOAD_ATTEMPTS = 3;
const LOAD_RETRY_DELAY_MS = 1_500;
const PUBLIC_TIERS = publicPricingTiers();

function MembershipTierMarketing({
  currentTier,
}: {
  currentTier?: string | null;
}): React.ReactElement {
  return (
    <section className="gv-membership__cards" aria-label="Insider tiers" data-testid="membership-tier-cards">
      <h2 className="gv-membership__section-title">Insider tiers</h2>
      <p className="gv-membership__meta" style={{ marginBottom: '1rem' }}>
        Locker Room and Film Room — recruiting, FutureCast, and film in one vault.
      </p>
      {PUBLIC_TIERS.map((tier) => (
        <article
          key={tier.id}
          data-membership-tier={tier.id}
          className={`gv-membership__card${currentTier === tier.id ? ' is-current' : ''}`}
        >
          <div className="gv-membership__card-head">
            <h3 className="gv-membership__card-name">
              {tier.icon} {tier.name}
              {tier.popular ? ' · Popular' : ''}
            </h3>
            <p className="gv-membership__card-price">
              ${tier.monthly.toFixed(2)}/month · ${tier.annual.toFixed(2)}/mo billed annually
            </p>
          </div>
          <ul className="gv-membership__features">
            {tier.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}

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

async function withTransientRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof MembershipAuthError) throw err;
      if (attempt >= LOAD_ATTEMPTS - 1 || !isMembershipTransportError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, LOAD_RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

export function AccountMembershipPage(): React.ReactElement {
  const [catalog, setCatalog] = useState<SubscriptionCatalog | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Elite: never block first paint on network. Guest teaser is the default shell.
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [billingReady, setBillingReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [guestMode, setGuestMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !loadSession()?.token;
  });
  const native = isNativeApp();
  const localSession = typeof window !== 'undefined' ? loadSession() : null;

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#delete-account") {
      const el = document.getElementById("delete-account");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [refreshing]);

  const loadMembership = useCallback(async () => {
    const session = loadSession();
    if (!session?.token) {
      // Elite public surface: show tiers + sign-in CTA instead of a blank redirect shell.
      setGuestMode(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setGuestMode(false);
    setLoading(false);
    setRefreshing(true);
    setError(null);
    setNeedsReauth(false);

    try {
      await verifyStoredSession({ keepLocalOnNetworkError: true });
      if (!loadSession()?.token) {
        // Only leave the page when the server confirmed the session is gone.
        replaceAuthLocation('/join/?mode=signin&reauth=1&next=/vault/membership/');
        return;
      }

      const [catalogResult, statusResult] = await Promise.allSettled([
        withTransientRetries(() => fetchSubscriptionCatalog()),
        withTransientRetries(() => fetchSubscriptionStatus()),
      ]);

      if (catalogResult.status === 'fulfilled') {
        setCatalog(catalogResult.value);
        if (native && catalogResult.value.iosPurchaseReady) {
          setBillingReady(await isIosBillingAvailable());
        }
      }

      if (statusResult.status === 'fulfilled') {
        setStatus(statusResult.value);
        setError(null);
      } else {
        const err = statusResult.reason;
        // Stay on Membership for soft failures — never wipe login or hard-navigate away.
        if (err instanceof MembershipAuthError) {
          setNeedsReauth(true);
          setError('Could not refresh membership for this session. Sign in again if this continues.');
        } else {
          setError(membershipLoadErrorMessage(err));
        }
      }

      if (catalogResult.status === 'rejected' && statusResult.status === 'rejected') {
        setError(membershipLoadErrorMessage(statusResult.reason));
      } else if (catalogResult.status === 'rejected') {
        setError((prev) => prev || 'Could not load subscription plans.');
      }
    } catch (err) {
      setError(membershipLoadErrorMessage(err));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [native]);

  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setError(null);
      void loadMembership();
    }
    if (params.get('checkout') === 'cancel') {
      setError('Checkout canceled — no charge was made.');
    }
  }, [loadMembership]);

  useEffect(() => {
    if (typeof window === "undefined" || refreshing) return;
    const params = new URLSearchParams(window.location.search);
    const upgrade = params.get("upgrade");
    if (!upgrade) return;
    const el = document.querySelector(`[data-membership-tier="${upgrade}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [refreshing]);

  async function refreshStatus(): Promise<SubscriptionStatus> {
    const st = await fetchSubscriptionStatus();
    setStatus(st);
    return st;
  }

  const webCheckoutReady =
    !native &&
    Boolean(status?.billing.webCheckoutEnabled || catalog?.webCheckoutEnabled);

  async function handleStripeCheckout(tierId: string, interval: 'monthly' | 'annual'): Promise<void> {
    const busyKey = `stripe:${tierId}:${interval}`;
    setPurchaseBusy(busyKey);
    setError(null);
    try {
      const { url } = await startStripeCheckout({ tier: tierId, interval });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start web checkout.');
      setPurchaseBusy(null);
    }
  }

  async function handleStripePortal(): Promise<void> {
    setPurchaseBusy('stripe-portal');
    setError(null);
    try {
      const { url } = await openStripeBillingPortal();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal.');
      setPurchaseBusy(null);
    }
  }

  async function handleSubscribe(productId: string): Promise<void> {
    if (!status?.email) return;
    setPurchaseBusy(productId);
    setError(null);
    try {
      const token = appAccountTokenForEmail(status.email);
      const purchase = await purchaseIosSubscription(productId, token);
      const next = await verifyApplePurchase({
        ...purchase,
        appAccountToken: token,
      });
      try {
        await finishIosPurchase(purchase.transactionId);
      } catch (ackErr) {
        // Global native listener may have already acknowledged — treat as success.
        const msg = ackErr instanceof Error ? ackErr.message : String(ackErr);
        if (!/already|acknowledged|not found/i.test(msg)) throw ackErr;
      }
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase could not be completed.');
    } finally {
      setPurchaseBusy(null);
    }
  }

  async function handleRestore(): Promise<void> {
    setPurchaseBusy('restore');
    setError(null);
    try {
      if (native && billingReady && status?.email) {
        const token = appAccountTokenForEmail(status.email);
        let synced = false;
        await restoreIosPurchasesWithSync(async (purchase) => {
          const next = await restoreApplePurchase({ ...purchase, appAccountToken: token });
          await finishIosPurchase(purchase.transactionId);
          setStatus(next);
          synced = true;
        });
        if (!synced) {
          const st = await refreshStatus();
          if (!st.accessActive && !st.paid) {
            setError(
              'No active Apple subscription found for this Apple ID. If you subscribed with a different Apple ID, sign into that one in Settings → App Store, then try Restore again.'
            );
          }
        }
      } else {
        await refreshStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore purchases.');
    } finally {
      setPurchaseBusy(null);
    }
  }

  function handleSignOut(): void {
    clearSession();
    replaceAuthLocation('/join/?mode=signin&reauth=1&next=/vault/membership/');
  }

  function handleRetryLoad(): void {
    // In-place retry — full reload on Capacitor can fall back to the marketing landing page.
    void loadMembership();
  }

  async function handleManageSubscriptions(): Promise<void> {
    try {
      await openIosSubscriptionManagement();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open subscription settings.');
    }
  }

  if (guestMode) {
    return (
      <div className="gv-membership" data-testid="vault-membership">
        <h1 className="gv-membership__title">GatorVault Membership</h1>
        <p className="gv-membership__sub">
          Sign in to manage your tier, trial, and billing — or preview what Insider unlocks.
        </p>
        <div className="gv-membership__actions" style={{ marginBottom: '1.25rem' }}>
          <a
            className="gv-membership__subscribe-btn"
            href={native ? nativeNavigationUrl('/join/?mode=signin&next=/vault/membership/') : '/join/?mode=signin&next=/vault/membership/'}
          >
            Sign in
          </a>
          <a
            className="gv-membership__secondary-btn"
            href={native ? nativeNavigationUrl('/join/?mode=signup&next=/vault/membership/') : '/join/?mode=signup&next=/vault/membership/'}
          >
            Create account
          </a>
        </div>
        <MembershipTierMarketing />
        <p className="gv-membership__meta">
          <Link href="/terms/">Membership Terms</Link>
          {' · '}
          <Link href="/vault/">Back to Vault</Link>
        </p>
      </div>
    );
  }

  const supportEmail = status?.billing.supportEmail || 'support@gatorvaultinsider.com';

  return (
    <div className="gv-membership" data-testid="vault-membership">
      <h1 className="gv-membership__title">Membership &amp; account</h1>
      <p className="gv-membership__sub">
        View your Insider tier, trial status, and billing options.
      </p>
      {refreshing && !status ? (
        <p className="gv-membership__meta" role="status" aria-live="polite">
          Refreshing membership…
        </p>
      ) : null}

      {error ? (
        <div className="gv-membership__error" role="alert">
          <p>{error}</p>
          <div className="gv-membership__actions">
            <button type="button" className="gv-membership__secondary-btn" onClick={handleRetryLoad}>
              Try again
            </button>
            {needsReauth ? (
              <button type="button" className="gv-membership__secondary-btn" onClick={handleSignOut}>
                Sign out and sign in again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!status?.email && localSession?.email ? (
        <section className="gv-membership__account" aria-label="Signed in account">
          <h2 className="gv-membership__section-title">Signed in</h2>
          <p className="gv-membership__meta">{localSession.email}</p>
          <p className="gv-membership__meta">
            {needsReauth
              ? 'Membership details could not be refreshed for this session.'
              : 'Membership details could not be loaded yet. Stay here and try again — you are still signed in.'}
          </p>
          {needsReauth ? (
            <button type="button" className="gv-membership__secondary-btn" onClick={handleSignOut}>
              Sign out and sign in again
            </button>
          ) : null}
        </section>
      ) : null}

      {status ? (
        <section className="gv-membership__status" aria-label="Current membership">
          <div className="gv-membership__status-row">
            {statusBadge(status)}
            <span className="gv-membership__badge">{String(status.tier).toUpperCase()} tier</span>
          </div>
          <p className="gv-membership__meta" data-testid="membership-trial-status">
            {status.paid
              ? status.subscription?.status === 'canceled'
                ? 'Paid access remains until your current Apple billing period ends. Auto-renew is off.'
                : 'Your paid membership is active.'
              : status.trial.expired
                ? webCheckoutReady
                  ? 'Your 30-day trial has ended. Subscribe below with secure web checkout, or continue in the iOS app.'
                  : 'Your 30-day trial has ended. Subscribe in the iOS app to restore full Vault access.'
                : status.trial.daysLeft != null
                  ? `Free trial: ${status.trial.daysLeft} day${
                      status.trial.daysLeft === 1 ? '' : 's'
                    } left${
                      status.trial.trialEndFormatted
                        ? ` · ends ${status.trial.trialEndFormatted}`
                        : ''
                    }.`
                  : 'Trial status unavailable.'}
          </p>
          {!native && !status.paid && status.trial.expired ? (
            <div className="gv-membership__actions" style={{ marginTop: '0.75rem' }}>
              {webCheckoutReady ? (
                <p className="gv-membership__meta">Choose a plan below to continue with secure card checkout.</p>
              ) : (
              <a
                className="gv-membership__subscribe-btn"
                href={status.billing.appStoreUrl || catalog?.appStoreUrl || 'https://apps.apple.com/app/id6783848215'}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue in App Store
              </a>
              )}
            </div>
          ) : null}
          {status.subscription?.source ? (
            <p className="gv-membership__meta">
              Billing source: {status.subscription.source}
              {status.subscription.productId ? ` · ${status.subscription.productId}` : ''}
            </p>
          ) : null}
        </section>
      ) : null}

      {status?.email ? (
        <section className="gv-membership__account" aria-label="Signed in account">
          <h2 className="gv-membership__section-title">Signed in</h2>
          <p className="gv-membership__meta">
            {status.email}
          </p>
          <button
            type="button"
            className="gv-membership__secondary-btn"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </section>
      ) : null}

      {(status?.email || localSession?.email) ? (
        <AccountDeletePanel
          email={(status?.email || localSession?.email) as string}
          paid={Boolean(status?.paid)}
          subscriptionSource={status?.subscription?.source}
        />
      ) : null}

      <section className="gv-membership__manage" aria-label="Manage subscription">
        <h2 className="gv-membership__section-title">Manage subscription</h2>
        {native || status?.subscription?.source === 'apple' ? (
          <>
            <p className="gv-membership__meta">{status?.billing.manageInAppHint}</p>
            {native ? (
              <div className="gv-membership__actions">
                <button
                  type="button"
                  className="gv-membership__secondary-btn"
                  onClick={() => void handleManageSubscriptions()}
                >
                  Manage in App Store
                </button>
                {catalog?.iosPurchaseReady ? (
                  <button
                    type="button"
                    className="gv-membership__secondary-btn"
                    disabled={Boolean(purchaseBusy)}
                    onClick={() => void handleRestore()}
                  >
                    {purchaseBusy === 'restore' ? 'Restoring…' : 'Restore purchases'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="gv-membership__meta">
              {status?.billing.manageWebHint ||
                'Paid membership continues in the GatorVault iOS app. Use the same email, then Subscribe or Restore.'}
            </p>
            <div className="gv-membership__actions">
              {webCheckoutReady && status?.subscription?.source === 'stripe' ? (
                <button
                  type="button"
                  className="gv-membership__subscribe-btn"
                  disabled={Boolean(purchaseBusy)}
                  onClick={() => void handleStripePortal()}
                >
                  {purchaseBusy === 'stripe-portal' ? 'Opening…' : 'Manage billing'}
                </button>
              ) : null}
              <a
                className="gv-membership__secondary-btn"
                href={
                  status?.billing.appStoreUrl ||
                  catalog?.appStoreUrl ||
                  'https://apps.apple.com/app/id6783848215'
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Open GatorVault on the App Store
              </a>
              <a
                className="gv-membership__secondary-btn"
                href={`mailto:${supportEmail}?subject=GatorVault%20membership%20help`}
              >
                Email {supportEmail}
              </a>
            </div>
            <p className="gv-membership__meta">
              <Link href="/terms/">Membership Terms</Link>
            </p>
          </>
        )}
        {catalog?.iosPurchaseReady && native && billingReady ? (
          <p className="gv-membership__meta">
            Subscribe below with Apple In-App Purchase. Purchases are verified with GatorVault before
            access unlocks.
          </p>
        ) : catalog?.iosPurchaseReady ? (
          <p className="gv-membership__meta">
            Apple billing is live. Open the iOS app, sign in with this email, then Subscribe or Restore
            purchases — web access unlocks automatically.
          </p>
        ) : webCheckoutReady ? (
          <p className="gv-membership__meta">
            Web checkout is available below. On iPhone, open the GatorVault app to subscribe with Apple In-App Purchase.
          </p>
        ) : (
          <p className="gv-membership__meta">
            Billing is temporarily unavailable. Email support if you need help restoring access.
          </p>
        )}
      </section>

      {!(catalog?.tiers || []).length ? <MembershipTierMarketing currentTier={status?.tier} /> : null}

      <section className="gv-membership__cards" aria-label="Available plans">
        {(catalog?.tiers || []).length ? (
          <h2 className="gv-membership__section-title">Insider tiers</h2>
        ) : null}
        {(catalog?.tiers || [])
          .filter((tier) => tier.id !== 'war' || status?.tier === 'war')
          .map((tier) => {
          const marketing = PUBLIC_TIERS.find((t) => t.id === tier.id);
          return (
          <article
            key={tier.id}
            data-membership-tier={tier.id}
            className={`gv-membership__card${status?.tier === tier.id ? ' is-current' : ''}`}
          >
            <div className="gv-membership__card-head">
              <h3 className="gv-membership__card-name">
                {tier.icon} {tier.name}
                {tier.popular ? ' · Popular' : ''}
              </h3>
              <p className="gv-membership__card-price">
                ${tier.monthlyUsd.toFixed(2)}/month · ${tier.annualUsd.toFixed(2)}/year
              </p>
              <p className="gv-membership__card-note">
                {webCheckoutReady
                  ? 'Auto-renewing subscription · billed monthly or annually (web card or Apple In-App Purchase)'
                  : 'Auto-renewing subscription · billed monthly or annually through Apple'}
              </p>
            </div>
            {marketing?.features?.length ? (
              <ul className="gv-membership__features">
                {marketing.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
            <p className="gv-membership__card-note">
              App Store product: {tier.products.monthly}
              {status?.tier === tier.id ? ' · Your current tier' : ''}
            </p>
            {native && catalog?.iosPurchaseReady && billingReady && status?.tier !== tier.id ? (
              <div className="gv-membership__subscribe-row">
                <button
                  type="button"
                  className="gv-membership__subscribe-btn"
                  disabled={Boolean(purchaseBusy)}
                  onClick={() => void handleSubscribe(tier.products.monthly)}
                >
                  {purchaseBusy === tier.products.monthly
                    ? 'Processing…'
                    : `Monthly · $${tier.monthlyUsd.toFixed(2)}`}
                </button>
                <button
                  type="button"
                  className="gv-membership__secondary-btn"
                  disabled={Boolean(purchaseBusy)}
                  onClick={() => void handleSubscribe(tier.products.annual)}
                >
                  {purchaseBusy === tier.products.annual
                    ? 'Processing…'
                    : `Annual · $${tier.annualUsd.toFixed(2)}`}
                </button>
              </div>
            ) : null}
            {webCheckoutReady && !status?.paid ? (
              <div className="gv-membership__subscribe-row">
                <button
                  type="button"
                  className="gv-membership__subscribe-btn"
                  disabled={Boolean(purchaseBusy)}
                  onClick={() => void handleStripeCheckout(tier.id, 'monthly')}
                >
                  {purchaseBusy === `stripe:${tier.id}:monthly`
                    ? 'Redirecting…'
                    : `Web monthly · $${tier.monthlyUsd.toFixed(2)}`}
                </button>
                <button
                  type="button"
                  className="gv-membership__secondary-btn"
                  disabled={Boolean(purchaseBusy)}
                  onClick={() => void handleStripeCheckout(tier.id, 'annual')}
                >
                  {purchaseBusy === `stripe:${tier.id}:annual`
                    ? 'Redirecting…'
                    : `Web annual · $${tier.annualUsd.toFixed(2)}`}
                </button>
              </div>
            ) : null}
          </article>
          );
        })}
      </section>

      <section className="gv-membership__cta">
        <p className="gv-membership__meta">
          {native || status?.subscription?.source === 'apple'
            ? 'Subscriptions renew automatically unless canceled at least 24 hours before the current period ends. Payment is charged to your Apple ID. Manage or cancel in your Apple ID subscription settings.'
            : webCheckoutReady
              ? 'Web subscriptions renew automatically via Stripe unless canceled. iOS purchases stay on Apple In-App Purchase. Same account unlocks both web and app after subscribe.'
              : 'Paid membership continues through the GatorVault iOS app (Apple In-App Purchase). After you subscribe on iOS, the same account unlocks the web Vault automatically.'}
        </p>
        <p>
          Questions:{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          {' · '}
          <a href="https://gatorvaultinsider.com/terms/" target="_blank" rel="noopener noreferrer">
            Terms of Use (EULA)
          </a>
          {' · '}
          <a href="https://gatorvaultinsider.com/privacy/" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
        </p>
      </section>
    </div>
  );
}
