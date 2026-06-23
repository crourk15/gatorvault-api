'use client';

import React, { useState } from 'react';
import { deleteAccount } from '@/lib/auth-api';

type Props = {
  email: string;
  paid: boolean;
  subscriptionSource?: string | null;
};

export function AccountDeletePanel({ email, paid, subscriptionSource }: Props): React.ReactElement {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    if (!password) {
      setError('Enter your password.');
      return;
    }
    if (confirm !== 'DELETE') {
      setError('Type DELETE in the confirmation field.');
      return;
    }
    setLoading(true);
    try {
      await deleteAccount({ password, confirm });
      window.location.replace('/welcome/?deleted=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="gv-membership__danger"
      id="delete-account"
      aria-label="Delete account"
      data-testid="account-delete-panel"
    >
      <h2 className="gv-membership__section-title">Delete account</h2>
      <p className="gv-membership__meta">
        Permanently remove your GatorVault login, membership profile, and Vault Points for{' '}
        <strong>{email}</strong>. This cannot be undone.
      </p>
      {paid ? (
        <p className="gv-membership__warn">
          {subscriptionSource === 'apple'
            ? 'If you subscribed through the iOS app, cancel your subscription in Settings → Apple ID → Subscriptions before deleting your account.'
            : 'You have an active paid membership. Contact support if you need billing help before deleting.'}
        </p>
      ) : null}
      {!open ? (
        <button
          type="button"
          className="gv-membership__danger-btn"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </button>
      ) : (
        <div className="gv-membership__danger-form">
          <label className="gv-membership__field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="gv-membership__field">
            <span>Type DELETE to confirm</span>
            <input
              type="text"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              placeholder="DELETE"
            />
          </label>
          {error ? <p className="gv-membership__error">{error}</p> : null}
          <div className="gv-membership__danger-actions">
            <button
              type="button"
              className="gv-membership__danger-btn is-confirm"
              onClick={() => void handleDelete()}
              disabled={loading}
            >
              {loading ? 'Deleting…' : 'Permanently delete account'}
            </button>
            <button
              type="button"
              className="gv-membership__danger-cancel"
              onClick={() => {
                setOpen(false);
                setPassword('');
                setConfirm('');
                setError(null);
              }}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
