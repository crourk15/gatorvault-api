'use client';

import React, { useEffect, useState } from 'react';
import { WelcomeA } from './WelcomeA';
import { WelcomeB } from './WelcomeB';

const STORAGE_KEY = 'welcome-variant';

type Variant = 'A' | 'B';

function pickVariant(): Variant {
  return Math.random() < 0.5 ? 'A' : 'B';
}

function readVariant(): Variant {
  if (typeof window === 'undefined') return 'A';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'A' || stored === 'B') return stored;
  const variant = pickVariant();
  localStorage.setItem(STORAGE_KEY, variant);
  return variant;
}

export function ABWelcomePage(): React.ReactElement {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    setVariant(readVariant());
  }, []);

  if (!variant) return <div className="welcome welcome-bright welcome--loading" aria-hidden="true" />;

  return variant === 'A' ? <WelcomeA /> : <WelcomeB />;
}
