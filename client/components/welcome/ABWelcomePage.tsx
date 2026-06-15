'use client';

import React, { useEffect, useState } from 'react';
import { WelcomeA } from './WelcomeA';
import { WelcomeB } from './WelcomeB';

const STORAGE_KEY = 'welcome-variant';

type Variant = 'A' | 'B';

function pickVariant(): Variant {
  return Math.random() < 0.5 ? 'A' : 'B';
}

export function ABWelcomePage(): React.ReactElement {
  // SSR/static export always renders variant A — never gate on client-only state.
  const [variant, setVariant] = useState<Variant>('A');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'A' || stored === 'B') {
        // Only switch if different from SSR default — prevents hydration flicker.
        if (stored !== 'A') {
          setVariant(stored);
        }
        return;
      }

      const picked = pickVariant();
      localStorage.setItem(STORAGE_KEY, picked);
      if (picked !== 'A') {
        setVariant(picked);
      }
    } catch {
      // localStorage blocked — keep SSR default (A).
    }
  }, []);

  // Match SSR markup until hydration completes.
  if (!hydrated) {
    return <WelcomeA />;
  }

  return variant === 'A' ? <WelcomeA /> : <WelcomeB />;
}
