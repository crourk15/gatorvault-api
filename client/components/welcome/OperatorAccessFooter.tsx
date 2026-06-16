'use client';

import React, { useState } from 'react';
import { loginWithOperatorPin } from '@/lib/operator-access';

/** Footer operator PIN — unlocks War Room admin + full access (legacy landing behavior). */
export function OperatorAccessFooter(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!pin.trim()) {
      setError('Enter your admin PIN.');
      return;
    }
    setLoading(true);
    try {
      await loginWithOperatorPin(pin.trim());
      window.setTimeout(() => {
        window.location.href = '/vault/admin';
      }, 120);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid PIN.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="gv-op-access" data-testid="operator-access-footer">
      <button
        type="button"
        className="gv-op-access__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Admin Access
      </button>
      {open ? (
        <div className="gv-op-access__panel">
          <p className="gv-op-access__hint">Operator PIN — unlocks War Room full access.</p>
          <div className="gv-op-access__row">
            <input
              type="password"
              className="gv-op-access__input"
              placeholder="Admin PIN"
              value={pin}
              autoComplete="off"
              inputMode="text"
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
                if (e.key === 'Escape') setOpen(false);
              }}
            />
            <button type="button" className="gv-op-access__btn" disabled={loading} onClick={() => void submit()}>
              {loading ? '…' : 'Enter'}
            </button>
            <button type="button" className="gv-op-access__cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {error ? <p className="gv-op-access__err">{error}</p> : null}
        </div>
      ) : null}
    </footer>
  );
}
