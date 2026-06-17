'use client';

import { useEffect, useRef } from 'react';
import { loginWithOperatorPin } from './operator-access';

export const OPERATOR_AUTO_PIN = 'GV2026admin';
export const OPERATOR_KEY_SEQUENCE = 'GVADMIN';

/** Legacy landing triggers: ?op=GV2026admin auto-unlock, GVADMIN keystroke opens PIN modal. */
export function useOperatorAccessGate(onOpenModal: () => void): void {
  const onOpenRef = useRef(onOpenModal);
  onOpenRef.current = onOpenModal;

  useEffect(() => {
    let cancelled = false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('op') !== OPERATOR_AUTO_PIN) return undefined;

      const timer = window.setTimeout(async () => {
        try {
          await loginWithOperatorPin(OPERATOR_AUTO_PIN);
          if (cancelled) return;
          window.location.href = '/vault/admin';
        } catch {
          if (!cancelled) onOpenRef.current();
        }
      }, 300);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    let buffer = '';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toUpperCase()).slice(-20);
      if (buffer.includes(OPERATOR_KEY_SEQUENCE)) {
        buffer = '';
        onOpenRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
