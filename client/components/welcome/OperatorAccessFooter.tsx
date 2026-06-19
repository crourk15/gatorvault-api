'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loginWithOperatorPin, OPERATOR_POST_LOGIN_HREF } from '@/lib/operator-access';
import { useOperatorAccessGate } from '@/lib/use-operator-access-gate';

/** Footer operator PIN — personal War Room login door (Recruiting Hub, not admin console). */
export function OperatorAccessFooter(): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback(() => {
    setError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPin('');
    setError(null);
  }, []);

  useOperatorAccessGate(openModal);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    document.body.classList.add('gv-op-access-open');
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove('gv-op-access-open');
    };
  }, [modalOpen]);

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
        window.location.href = OPERATOR_POST_LOGIN_HREF;
      }, 120);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid PIN.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <footer className="gv-op-access" data-testid="operator-access-footer">
        <button
          type="button"
          className="gv-op-access__toggle"
          onClick={openModal}
          aria-haspopup="dialog"
        >
          Admin Access
        </button>
      </footer>

      {modalOpen ? (
        <div
          className="gv-op-access-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gv-op-access-title"
          data-testid="operator-access-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="gv-op-access-modal__card">
            <h2 id="gv-op-access-title" className="gv-op-access-modal__title">
              Operator Access
            </h2>
            <p className="gv-op-access-modal__hint">
              Enter your admin PIN to unlock full War Room access.
            </p>
            <div className="gv-op-access__row">
              <input
                ref={inputRef}
                type="password"
                className="gv-op-access__input"
                placeholder="Admin PIN"
                value={pin}
                autoComplete="off"
                inputMode="text"
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                  if (e.key === 'Escape') closeModal();
                }}
              />
              <button
                type="button"
                className="gv-op-access__btn"
                disabled={loading}
                onClick={() => void submit()}
              >
                {loading ? '…' : 'Unlock'}
              </button>
              <button type="button" className="gv-op-access__cancel" onClick={closeModal}>
                Cancel
              </button>
            </div>
            {error ? <p className="gv-op-access__err">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
