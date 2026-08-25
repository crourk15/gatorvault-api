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
  requestPasswordReset,
  resetPasswordWithToken,
  type PaymentTierId,
} from '@/lib/auth-api';
import { findPricingTier, publicPricingTiers, PRICING_TIERS } from '@/lib/pricing-tiers';
import { LegalSiteLinks } from '@/components/site/LegalSiteLinks';
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';
import { firstTouchForRegister } from '@/lib/first-touch-attribution';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

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

function isResetLinkPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  return /\/reset(?:\/|index\.html|$)/.test(path);
}

function initialJoinMode(): Mode {
  if (typeof window === 'undefined') return 'signup';
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'forgot') return 'forgot';
  if (params.get('mode') === 'reset' || isResetLinkPath()) return 'reset';
  if (params.get('mode') === 'signin') return 'signin';
  if (params.get('mode') === 'signup') return 'signup';
  // Native shell: Sign in first (App Review). Web guests without a remembered email → Create account.
  if (isNativeApp()) return 'signin';
  if (readLastEmail()) return 'signin';
  return 'signup';
}

export function JoinPage(): React.ReactElement {
  const [mode, setMode] = useState<Mode>(initialJoinMode);
  const [tier, setTier] = useState<PaymentTierId>('film');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialMembershipHref, setTrialMembershipHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<{ email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const native = isNativeApp();

  useEffect(() => {
    // Silent first-touch — no extra signup step for the member.
    firstTouchForRegister();
    setTier(tierFromQuery());
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signin') setMode('signin');
    if (params.get('mode') === 'signup') setMode('signup');
    if (params.get('mode') === 'forgot') setMode('forgot');
    if (params.get('mode') === 'reset' || isResetLinkPath()) {
      setMode('reset');
      const token = params.get('token') || '';
      const resetEmail = params.get('email') || '';
      if (token) setResetToken(token);
      if (resetEmail) setEmail(resetEmail);
    }
    const remembered = readLastEmail();
    if (remembered && params.get('mode') !== 'reset' && !isResetLinkPath()) setEmail(remembered);
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
      if (session.trialExpired || session.accessActive === false) {
        setSuccess(
          `Signed in as ${session.email}. Your free trial has ended — opening Membership to restore access…`
        );
        window.setTimeout(() => {
          replaceAuthLocation(session.membershipUrl || '/vault/membership/?trial=ended');
        }, 900);
        return;
      }
      setSuccess(`Signed in as ${session.email}. Opening the Vault…`);
      redirectAfterAuth();
    } catch (err) {
      const trialErr = err as Error & { trialExpired?: boolean; membershipUrl?: string };
      if (trialErr.trialExpired) {
        setError(trialErr.message);
        setTrialMembershipHref(trialErr.membershipUrl || '/vault/membership/?trial=ended');
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
        firstTouch: firstTouchForRegister(),
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


  async function handleForgot(): Promise<void> {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError('Enter the email for your account.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(): Promise<void> {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !resetToken.trim()) {
      setError(
        'This reset link is invalid or incomplete. Open the latest email in Safari or Chrome (not the GatorVault app), or request a new link.'
      );
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPasswordWithToken({
        email: email.trim().toLowerCase(),
        token: resetToken.trim(),
        password,
      });
      setSuccess(result.message);
      setMode('signin');
      setPassword('');
      setResetToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gv-join" data-testid="join-page">
      <div className="gv-join__card">
        <span className="gv-join__logo" aria-hidden="true">
          🐊
        </span>
        <h1 className="gv-join__title">
          {mode === 'signin'
            ? 'Sign in to GatorVault'
            : mode === 'forgot'
              ? 'Reset your password'
              : mode === 'reset'
                ? 'Choose a new password'
                : 'Join GatorVault'}
        </h1>
        <p className="gv-join__sub">
          {existingSession
            ? "You are already signed in — continue below."
            : mode === 'signin'
              ? 'Already a member? Sign in with your email and password. New here? Tap Create account — 30-day free trial, no card.'
              : mode === 'forgot'
                ? 'Enter your account email and we will send a reset link if it exists.'
                : mode === 'reset'
                  ? 'Set a password for your GatorVault account. Use the latest email link — it stays valid for 24 hours.'
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
            {mode === 'signin' || mode === 'signup' ? (
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
            ) : null}

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
              {mode !== 'forgot' ? (
              <label className="gv-join__field">
                <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
                <input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' || mode === 'reset' ? '8+ characters' : 'Your password'}
                />
              </label>
              ) : null}

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
                onClick={() =>
                  void (mode === 'signin'
                    ? handleSignIn()
                    : mode === 'forgot'
                      ? handleForgot()
                      : mode === 'reset'
                        ? handleResetPassword()
                        : handleSignUp())
                }
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'signin'
                    ? 'Sign in'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : mode === 'reset'
                        ? 'Update password'
                        : 'Create account'}
              </button>
              {mode === 'signin' ? (
                <p className="gv-join__tier-note" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="gv-join__tier-link"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    Forgot password?
                  </button>
                </p>
              ) : null}
              {mode === 'forgot' || mode === 'reset' ? (
                <p className="gv-join__tier-note" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="gv-join__tier-link"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    Back to sign in
                  </button>
                </p>
              ) : null}
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
