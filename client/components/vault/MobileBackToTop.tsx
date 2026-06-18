'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';

/** Floating back-to-top for long vault pages (FutureCast has its own anchor bar). */
export function MobileBackToTop(): React.ReactElement | null {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const isFutureCastLab =
    pathname.replace(/\/$/, '') === '/vault/futurecast' ||
    pathname.replace(/\/$/, '') === '/futurecast';

  useEffect(() => {
    if (isFutureCastLab) return;
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isFutureCastLab]);

  if (isFutureCastLab || !visible) return null;

  return (
    <button
      type="button"
      className="gv-mobile-back-top"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  );
}
