'use client';

import { useEffect, useRef } from 'react';

/** Adds gv-card--visible when element scrolls into view (desktop fade-in). */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  className = 'gv-card--scroll-in'
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add(className);

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('gv-card--visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('gv-card--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [className]);

  return ref;
}
