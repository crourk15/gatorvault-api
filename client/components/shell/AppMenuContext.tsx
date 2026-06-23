'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { syncVaultMenuBootOpen } from '@/lib/vault-menu-boot';

type AppMenuContextValue = {
  isOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

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
    setIsOpen(true);
    syncVaultMenuBootOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    syncVaultMenuBootOpen(false);
  }, []);
  const toggleMenu = useCallback(() => {
    setIsOpen((v) => {
      const next = !v;
      syncVaultMenuBootOpen(next);
      return next;
    });
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
