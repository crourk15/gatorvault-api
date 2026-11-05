'use client';

import React from 'react';
import { Button } from '@/components/brand';
import { WELCOME_LINKS } from './links';

export function LandingFinalCTA(): React.ReactElement {
  return (
    <section className="gv-final-cta" data-testid="welcome-footer">
      <div className="gv-final-container">
        <h2 className="gv-final-title">Ready to enter the Vault?</h2>
        <p className="gv-final-sub">
          Join now and get the board, FutureCast, Game Week, and film in one place. 30-day free
          trial — no card required.
        </p>
        <div className="gv-final-buttons">
          <Button href="/join?tier=film" variant="primary">
            Join GatorVault
          </Button>
          <Button href={WELCOME_LINKS.vault} variant="secondary">
            Enter Vault
          </Button>
        </div>
      </div>
    </section>
  );
}
