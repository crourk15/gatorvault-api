'use client';

import React, { useEffect, useState } from 'react';
import {
  loginAccount,
  registerAccount,
  saveSession,
  ensureSessionHydrated,
  verifyStoredSession,
  clearSession,
  safeAuthRedirectPath,
  replaceAuthLocation,
  type PaymentTierId,
} from '@/lib/auth-api';
import { findPricingTier, publicPricingTiers, PRICING_TIERS } from '@/lib/pricing-tiers';
import { LegalSiteLinks } from '@/components/site/LegalSiteLinks';
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';

type Mode = 'signin' | 'signup';

const LAST_EMAIL_KEY = 'gv_last_email';

function tierFromQuery(): PaymentTierId {
  if (typeof window === 'undefined') return 'film';
  const t = new URLSearchParams(window.location.search).get('tier');
  if (t === 'locker' || t === 'film' || t === 'war') return t;
  return 'film';
}

function readLastEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(localStorage.getItem(LAST_EMAIL_KEY) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function rememberLastEmail(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = email.trim().toLowerCase();
    if (normalized) localStorage.setItem(LAST_EMAIL_KEY, normalized);
  } catch {
    /* ignore */
  }
}

function redirectAfterAuth(): void {
  try {
    sessionStorage.setItem('gv_auth_handoff', '1');
  } catch {
    /* private mode */
  }
  const next = new URLSearchParams(window.location.search).get('next');
  const dest = safeAuthRedirectPath(next, '/vault/');
  const target =
    isNativeApp() || window.location.hostname === 'gatorvaultinsider.com'
      ? nativeNavigationUrl(dest)
      : dest;
  window.setTimeout(() => {
    window.location.replace(target);
  }, 150);
}

function initialJoinMode(): Mode {
  if (typeof window === 'undefined') return 'signup';
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'signin') return 'signin';
  if (params.get('mode') === 'signup') return 'signup';
  // Returning app users / prior emails → Sign in, not Create account.
  if (readLastEmail() || isNativeApp()) return 'signin';
  return 'signup';
}

export function JoinPage(): React.ReactElement {
  const [mode, setMode] = useState<Mode>(initialJoinMode);
  const [tier, setTier] = useState<PaymentTierId>('film');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialMembershipHref, setTrialMembershipHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<{ email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const native = isNativeApp();

  useEffect(() => {
    setTier(tierFromQuery());
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signin') setMode('signin');
    if (params.get('mode') === 'signup') setMode('signup');
    const remembered = readLastEmail();
    if (remembered) setEmail(remembered);
    if (params.get('reauth') === '1' || params.get('switch') === '1') {
      clearSession();
      setExistingSession(null);
      setCheckingSession(false);
      setMode('signin');
      return;
    }

    let cancelled = false;
    void ensureSessionHydrated()
      .then(() => verifyStoredSession({ keepLocalOnNetworkError: true }))
      .then((session) => {
        if (cancelled) return;
        setCheckingSession(false);
        if (!session?.email || !session?.token) {
          setExistingSession(null);
          return;
        }
        rememberLastEmail(session.email);
        setExistingSession({ email: session.email });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checkingSession || !existingSession) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('tier')) return;
    const t = tierFromQuery();
    const dest = new URLSearchParams({ upgrade: t });
    const next = params.get('next');
    if (next?.startsWith('/')) dest.set('next', next);
    replaceAuthLocation(`/vault/membership/?${dest.toString()}`);
  }, [checkingSession, existingSession]);

  const tierMeta = findPricingTier(tier);
  const publicTiers = publicPricingTiers();
  const warTier = PRICING_TIERS.find((t) => t.id === 'war');

  function continueAsExisting(): void {
    redirectAfterAuth();
  }

  function switchAccount(): void {
    clearSession();
    setExistingSession(null);
    setError(null);
    setSuccess(null);
    const params = new URLSearchParams(window.location.search);
    params.set('reauth', '1');
    params.delete('switch');
    window.history.replaceState(null, '', `/join/?${params.toString()}`);
  }

  const handleSignIn = async () => {
    setError(null);
    setTrialMembershipHref(null);
    if (!email.trim() || !password) {
      setError('Enter the email and password from your account (not your display name).');
      return;
    }
    setLoading(true);
    try {
      const session = await loginAccount({ email: email.trim().toLowerCase(), password });
      rememberLastEmail(session.email);
      saveSession(session);
      setExistingSession({ email: session.email });
      setSuccess(`Signed in as ${session.email}. Opening the Vault…`);
      redirectAfterAuth();
    } catch (err) {
      const trialErr = err as Error & { trialExpired?: boolean; membershipUrl?: string };
      if (trialErr.trialExpired) {
        setError(trialErr.message);
        setTrialMembershipHref(trialErr.membershipUrl || '/vault/membership/');
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError('Use a valid email and password (8+ characters).');
      return;
    }
    if (!terms) {
      setError('Accept the terms to create your account.');
      return;
    }
    setLoading(true);
    try {
      const { session, emailSent, trialExpired, trialReused } = await registerAccount({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        tier,
      });
      rememberLastEmail(session.email);
      saveSession(session);
      setExistingSession({ email: session.email });
      const days =
        typeof session.daysLeft === 'number' ? session.daysLeft : null;
      if (trialExpired) {
        setSuccess(
          `Signed in as ${session.email}. Your free trial for this email already ended. Opening Membership…`
        );
        window.setTimeout(() => {
          replaceAuthLocation('/vault/membership/');
        }, 1200);
        return;
      }
      const trialLine =
        days != null
          ? ` ${days} day${days === 1 ? '' : 's'} left in your free trial.`
          : ' Your 30-day free trial is active.';
      setSuccess(
        emailSent
          ? `Account created and signed in as ${session.email}. Welcome email sent.${trialLine} Opening the Vault…`
          : `Account created and signed in as ${session.email}.${trialLine}${
              trialReused ? ' (same trial window as your earlier account).' : ''
            } Opening the Vault…`
      );
      window.setTimeout(redirectAfterAuth, 1400);
    } catch (err) {
      const regErr = err as Error & { code?: string; status?: number };
      if (regErr.status === 409 || regErr.code === 'email_taken') {
        setMode('signin');
        setError(
          "That email already has an account. Use Sign in with the same email and password — do not create another account."
        );
      } else {
        setError(err instanceof Error ? err.message : 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gv-join" data-testid="join-page">
      <div className="gv-join__card">
        <span className="gv-join__logo" aria-hidden="true">
          🐊
        </span>
        <h1 className="gv-join__title">{mode === 'signin' ? 'Sign in to GatorVault' : 'Join GatorVault'}</h1>
        <p className="gv-join__sub">
          {existingSession
            ? "You are already signed in — continue below."
            : mode === 'signin'
              ? 'Sign in with your account email and password (not your display name).'
              : `${tierMeta.name} — 30-day free trial, no card required.`}
        </p>

        {checkingSession ? (
          <p className="gv-join__sub">Checking sign-in status…</p>
        ) : null}

        {existingSession ? (
          <div className="gv-join__existing" data-testid="join-existing-session">
            <p className="gv-join__sub">
              Signed in as <strong>{existingSession.email}</strong>.
            </p>
            {success ? <p className="gv-join__success">{success}</p> : null}
            <div className="gv-join__existing-actions">
              <button type="button" className="gv-join__submit" onClick={continueAsExisting}>
                Continue to Vault
              </button>
              <button type="button" className="gv-join__secondary" onClick={switchAccount}>
                Use a different account
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="gv-join__tabs">
              <button
                type="button"
                className={mode === 'signin' ? 'is-active' : ''}
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'is-active' : ''}
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Create account
              </button>
            </div>

            {mode === 'signup' && (
              <>
                <div className="gv-join__tier-row">
                  {publicTiers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`gv-join__tier${tier === t.id ? ' is-active' : ''}`}
                      onClick={() => setTier(t.id)}
                    >
                      {t.icon} {t.name}
                    </button>
                  ))}
                </div>
                {warTier && tier === 'war' ? (
                  <p className="gv-join__tier-note">
                    {warTier.icon} {warTier.name} — early access tier selected.
                  </p>
                ) : warTier ? (
                  <p className="gv-join__tier-note">
                    <button type="button" className="gv-join__tier-link" onClick={() => setTier('war')}>
                      War Room early access
                    </button>{' '}
                    — for existing insiders only.
                  </p>
                ) : null}
                <p className="gv-join__tier-note">
                  Already joined? Use <strong>Sign in</strong> with the same email — creating again
                  will not work for that address.
                </p>
              </>
            )}

            <div className="gv-join__form">
              {mode === 'signup' && (
                <label className="gv-join__field">
                  <span>Name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
              )}
              <label className="gv-join__field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </label>
              <label className="gv-join__field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? '8+ characters' : 'Your password'}
                />
              </label>

              {mode === 'signup' && (
                <label className="gv-join__terms">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    I agree to the{' '}
                    <a href="/terms/" target="_blank" rel="noopener noreferrer">
                      membership terms
                    </a>{' '}
                    and{' '}
                    <a href="/privacy/" target="_blank" rel="noopener noreferrer">
                      privacy policy
                    </a>
                    .
                  </span>
                </label>
              )}

              {error ? (
                <p className="gv-join__error">
                  {error}
                  {trialMembershipHref ? (
                    <>
                      {' '}
                      <a href={native ? nativeNavigationUrl(trialMembershipHref) : trialMembershipHref}>
                        View membership →
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {success ? <p className="gv-join__success">{success}</p> : null}

              <button
                type="button"
                className="gv-join__submit"
                disabled={loading}
                onClick={() => void (mode === 'signin' ? handleSignIn() : handleSignUp())}
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </>
        )}

        <p className="gv-join__guest">
          <a href={native ? nativeNavigationUrl('/vault/') : '/vault/'}>Preview the Vault</a>{' '}
          (limited access)
        </p>
        {!native ? (
          <p className="gv-join__back">
            <a href="/vault/">Enter Vault</a>
          </p>
        ) : null}
        <LegalSiteLinks className="gv-join__legal gv-legal-links" />
      </div>
    </div>
  );
}
