'use client';

import React, { useEffect, useState } from 'react';
import {
  loginAccount,
  loadSession,
  registerAccount,
  saveSession,
  type PaymentTierId,
} from '@/lib/auth-api';
import { PRICING_TIERS } from '@/lib/pricing-tiers';

type Mode = 'signin' | 'signup';

function tierFromQuery(): PaymentTierId {
  if (typeof window === 'undefined') return 'film';
  const t = new URLSearchParams(window.location.search).get('tier');
  if (t === 'locker' || t === 'film' || t === 'war') return t;
  return 'film';
}

function redirectAfterAuth(): void {
  const next = new URLSearchParams(window.location.search).get('next');
  window.location.href = next && next.startsWith('/') ? next : '/vault';
}

export function JoinPage(): React.ReactElement {
  const [mode, setMode] = useState<Mode>('signup');
  const [tier, setTier] = useState<PaymentTierId>('film');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTier(tierFromQuery());
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signin') setMode('signin');
    const existing = loadSession();
    if (existing?.email) {
      redirectAfterAuth();
    }
  }, []);

  const tierMeta = PRICING_TIERS.find((t) => t.id === tier) ?? PRICING_TIERS[1];

  const handleSignIn = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const session = await loginAccount({ email: email.trim().toLowerCase(), password });
      saveSession(session);
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
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
      const { session, emailSent } = await registerAccount({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        tier,
      });
      saveSession(session);
      setSuccess(
        emailSent
          ? 'Account created! Welcome email sent — redirecting to the Vault…'
          : 'Account created! Redirecting to the Vault…'
      );
      window.setTimeout(redirectAfterAuth, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
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
          {mode === 'signin'
            ? 'Use the email and password from your account.'
            : `${tierMeta.name} — 30-day free trial, no card required.`}
        </p>

        <div className="gv-join__tabs">
          <button
            type="button"
            className={mode === 'signup' ? 'is-active' : ''}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === 'signin' ? 'is-active' : ''}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
        </div>

        {mode === 'signup' && (
          <div className="gv-join__tier-row">
            {PRICING_TIERS.map((t) => (
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
              <span>I agree to the membership terms and privacy policy.</span>
            </label>
          )}

          {error ? <p className="gv-join__error">{error}</p> : null}
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

        <p className="gv-join__guest">
          <a href="/vault">Preview the Vault</a> (limited access)
        </p>
        <p className="gv-join__back">
          <a href="/">← Back to home</a>
        </p>
      </div>
    </div>
  );
}
