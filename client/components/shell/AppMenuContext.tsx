'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readVaultMenuBootOpen, syncVaultMenuBootOpen } from '@/lib/vault-menu-sync';

type AppMenuContextValue = {
  isOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

function hasMenuBoot(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__GV_MENU_BOOT__);
}

/**
 * Vault: boot script owns clicks; React mirrors via boot.onChange.
 * Flat AppShell (no boot): React owns open state directly.
 */
export function AppMenuProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const boot = window.__GV_MENU_BOOT__;
    if (!boot) return undefined;
    setIsOpen(boot.isOpen());
    boot.onChange = setIsOpen;
    return () => {
      boot.onChange = null;
    };
  }, []);

  const openMenu = useCallback(() => {
    if (hasMenuBoot()) {
      syncVaultMenuBootOpen(true);
      return;
    }
    setIsOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    if (hasMenuBoot()) {
      syncVaultMenuBootOpen(false);
      return;
    }
    setIsOpen(false);
  }, []);
  const toggleMenu = useCallback(() => {
    if (hasMenuBoot()) {
      syncVaultMenuBootOpen(!readVaultMenuBootOpen());
      return;
    }
    setIsOpen((v) => !v);
  }, []);

  const value = useMemo(
    () => ({ isOpen, openMenu, closeMenu, toggleMenu }),
    [isOpen, openMenu, closeMenu, toggleMenu],
  );

  return <AppMenuContext.Provider value={value}>{children}</AppMenuContext.Provider>;
}

export function useAppMenu(): AppMenuContextValue {
  const ctx = useContext(AppMenuContext);
  if (!ctx) {
    throw new Error('useAppMenu must be used within AppMenuProvider');
  }
  return ctx;
}
