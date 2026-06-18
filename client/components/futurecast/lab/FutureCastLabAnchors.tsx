'use client';

import React, { useEffect, useState } from 'react';
import { FUTURECAST_LAB_SECTIONS } from '@/lib/vault-route-map';

export function FutureCastLabAnchors(): React.ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`fc-lab-anchors${visible ? ' is-visible' : ''}`}
      data-testid="fc-lab-anchors"
      aria-label="FutureCast Lab section navigation"
    >
      <div className="fc-lab-anchors__sections">
        {FUTURECAST_LAB_SECTIONS.map((section) => (
          <a key={section.id} href={section.href} className="fc-lab-anchors__btn">
            {section.shortLabel}
          </a>
        ))}
      </div>
      <button type="button" className="fc-lab-anchors__top" onClick={scrollTop}>
        ↑ Top
      </button>
    </div>
  );
}
