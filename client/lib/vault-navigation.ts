'use client';

import { useCallback, useEffect, useRef } from 'react';
import { prefetchVaultHref, warmVaultBottomNavRoutes, warmVaultDrawerRoutes, warmVaultPlayerRoute, warmVaultRoute } from '@/lib/vault-preload';

export { prefetchVaultHref, warmVaultBottomNavRoutes, warmVaultDrawerRoutes, warmVaultPlayerRoute, warmVaultRoute };

const STATE_PREFIX = 'gv-vault-state:';

export type VaultPageState = {
  scrollY?: number;
  tab?: string;
  search?: string;
  phase?: string;
  rosterFilter?: string;
  classYear?: number;
  viewMode?: string;
  tierFilter?: string;
  sortMode?: string;
  rankYear?: number;
  filters?: Record<string, string>;
};

export function saveVaultPageState(pageKey: string, state: VaultPageState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${STATE_PREFIX}${pageKey}`, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function peekVaultPageState(pageKey: string): VaultPageState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STATE_PREFIX}${pageKey}`);
    return raw ? (JSON.parse(raw) as VaultPageState) : null;
  } catch {
    return null;
  }
}

export function consumeVaultPageState(pageKey: string): VaultPageState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STATE_PREFIX}${pageKey}`);
    if (!raw) return null;
    sessionStorage.removeItem(`${STATE_PREFIX}${pageKey}`);
    return JSON.parse(raw) as VaultPageState;
  } catch {
    return null;
  }
}

export function notifyVaultNavigation(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('vault:navigation'));
}

export function vaultTeamBackHref(): string {
  const state = peekVaultPageState('team');
  const params = new URLSearchParams();
  if (state?.tab && state.tab !== 'roster') params.set('tab', state.tab);
  if (state?.search) params.set('q', state.search);
  const qs = params.toString();
  return qs ? `/vault/team?${qs}` : '/vault/team';
}

export function useVaultPageRestore(
  pageKey: string,
  onRestore: (state: VaultPageState) => void
): void {
  const restoredRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = consumeVaultPageState(pageKey);
    if (saved) onRestoreRef.current(saved);
    if (saved?.scrollY != null) {
      requestAnimationFrame(() => window.scrollTo(0, saved.scrollY ?? 0));
    }
  }, [pageKey]);
}

/** Re-run data loaders when returning via bfcache. */
export function useVaultDataReload(reload: () => void): void {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) reload();
    };
    const onRestore = () => reload();
    window.addEventListener('pageshow', onShow);
    window.addEventListener('vault:pageshow-restore', onRestore);
    return () => {
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('vault:pageshow-restore', onRestore);
    };
  }, [reload]);
}

export function bindVaultLinkState(
  el: HTMLElement,
  pageKey: string,
  getState: () => VaultPageState
): () => void {
  const onClick = () => saveVaultPageState(pageKey, getState());
  const onEnter = () => {
    const href = el.getAttribute('href');
    if (!href) return;
    if (/\/player\/|\/players\//.test(href)) warmVaultPlayerRoute(href);
    else prefetchVaultHref(href);
  };
  el.addEventListener('click', onClick);
  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('focus', onEnter);
  el.addEventListener('touchstart', onEnter, { passive: true });
  return () => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('focus', onEnter);
    el.removeEventListener('touchstart', onEnter);
  };
}
