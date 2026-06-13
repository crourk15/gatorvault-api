'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function TeamModal(): React.ReactElement | null {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      id="gv-team-detail-modal"
      className="highlight-modal-ov hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gv-team-modal-title"
      aria-hidden="true"
    >
      <div className="gv-team-modal-panel" id="gv-team-modal-panel">
        <div className="gv-team-modal-drag" aria-hidden="true" />
        <div className="gv-team-modal-toolbar">
          <button type="button" id="gv-team-modal-share" className="gv-team-modal-btn" aria-label="Share">
            ⎘
          </button>
          <button type="button" id="gv-team-detail-close" className="gv-team-modal-btn" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="gv-team-modal-hero" id="gv-team-modal-hero">
          <img id="gv-team-modal-hero-img" className="gv-team-modal-hero-img hidden" alt="" />
          <div className="gv-team-modal-hero-overlay" />
          <div className="gv-team-modal-hero-text">
            <span className="gv-team-modal-kicker" id="gv-team-modal-kicker">
              Program History
            </span>
            <h2 className="gv-team-modal-title" id="gv-team-modal-title">
              Florida Gators
            </h2>
          </div>
        </div>
        <div id="gv-team-detail-body" className="gv-team-modal-body" />
      </div>
    </div>,
    document.body
  );
}
