'use client';

import React, { useEffect, useState } from 'react';
import { WelcomeA } from './WelcomeA';
import { WelcomeB } from './WelcomeB';

const STORAGE_KEY = 'welcome-variant';

type Variant = 'A' | 'B';

function pickVariant(): Variant {
  return Math.random() < 0.5 ? 'A' : 'B';
}

/** A/B wrapper — both variants share the same layout; avoid hydration swap flicker. */
export function ABWelcomePage(): React.ReactElement {
  const [variant, setVariant] = useState<Variant>('A');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'A' || stored === 'B') {
        setVariant(stored);
        return;
      }
      const picked = pickVariant();
      localStorage.setItem(STORAGE_KEY, picked);
      setVariant(picked);
    } catch {
      /* localStorage blocked — keep default A */
    }
  }, []);

  return variant === 'B' ? <WelcomeB /> : <WelcomeA />;
}
