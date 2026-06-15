'use client';

import React from 'react';
import { Button, Container, HeadingXL, BodyL } from '@/components/ui';
import { WELCOME_LINKS } from '@/components/welcome/links';

export function InsiderHero(): React.ReactElement {
  return (
    <section className="insider-hero gv-section--hero" data-testid="insider-hero">
      <div className="insider-hero__gradient" aria-hidden="true" />
      <div className="insider-hero__lights" aria-hidden="true" />
      <div className="insider-hero__motion" aria-hidden="true" />
      <Container>
        <div className="insider-hero__inner">
          <HeadingXL>Unlock the Full GatorVault Experience</HeadingXL>
          <BodyL>Film Room, War Room, Insider Intel, and more.</BodyL>
          <div className="insider-hero__actions">
            <Button href={WELCOME_LINKS.join} variant="primary">
              Become an Insider
            </Button>
            <Button href="/welcome" variant="secondary">
              See the Welcome Tour
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
