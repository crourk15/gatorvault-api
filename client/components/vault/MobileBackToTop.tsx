'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from '@/lib/use-pathname';

function readScrollTop(): number {
  const scrolling = document.scrollingElement;
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body?.scrollTop || 0,
    scrolling?.scrollTop || 0
  );
}

/** Force document + body scrollports to top — iOS WKWebView can keep either live. */
function scrollDocumentToTop(): void {
  const targets = [
    document.scrollingElement,
    document.documentElement,
    document.body,
  ].filter(Boolean) as Array<Element & { scrollTo?: typeof window.scrollTo; scrollTop?: number }>;

  for (const el of targets) {
    try {
      el.scrollTo?.({ top: 0, behavior: 'auto' });
    } catch {
      /* ignore */
    }
    try {
      if (typeof el.scrollTop === 'number') el.scrollTop = 0;
    } catch {
      /* ignore */
    }
  }
  try {
    window.scrollTo(0, 0);
  } catch {
    /* ignore */
  }
}

/** Floating back-to-top for long vault pages (FutureCast has its own anchor bar). */
export function MobileBackToTop(): React.ReactElement | null {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const lastActivateAt = useRef(0);

  const isFutureCastLab =
    pathname.replace(/\/$/, '') === '/vault/futurecast' ||
    pathname.replace(/\/$/, '') === '/futurecast';

  useEffect(() => {
    if (isFutureCastLab) return;
    const onScroll = () => setVisible(readScrollTop() > 480);
    onScroll();
    // Capture on both window + document: dual scrollports on iOS may not
    // bubble window.scrollY when body/html fight.
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [isFutureCastLab]);

  if (isFutureCastLab || !visible) return null;

  const activate = () => {
    const now = Date.now();
    if (now - lastActivateAt.current < 400) return;
    lastActivateAt.current = now;
    scrollDocumentToTop();
    setVisible(false);
  };

  return (
    <button
      type="button"
      className="gv-mobile-back-top"
      data-testid="mobile-back-to-top"
      aria-label="Back to top"
      onClick={activate}
      onTouchEnd={(e) => {
        // iOS can drop the synthetic click after a fling; honor the tap.
        e.preventDefault();
        activate();
      }}
    >
      ↑
    </button>
  );
}
