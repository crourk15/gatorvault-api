'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Container, HeadingL, HeadingM, BodyM, Section } from '@/components/ui';

const BREAKDOWNS = [
  {
    title: 'QB Cut-Up: Top 2027 Targets',
    subtitle: 'Staff-style evaluation · 12 min',
    image: '/images/podcasts/gators-breakdown.png',
    href: '/vault/film-room',
  },
  {
    title: 'Edge Rushers: Portal Watch',
    subtitle: 'Film breakdown · 8 min',
    image: '/images/podcasts/gators-online.png',
    href: '/vault/film-room',
  },
  {
    title: 'WR Room Depth Analysis',
    subtitle: 'Cut-up series · 15 min',
    image: '/images/podcasts/gator-tales.png',
    href: '/vault/film-room',
  },
] as const;

export function FilmRoomPreviewSection(): React.ReactElement {
  return (
    <Section className="insider-section insider-section--alt" data-testid="insider-film-room">
      <Container>
        <div className="insider-section__header">
          <HeadingL>Film Room Preview</HeadingL>
          <BodyM>Latest breakdowns from the GatorVault film room.</BodyM>
        </div>
        <div className="insider-preview-grid">
          {BREAKDOWNS.map((item) => (
            <Link key={item.title} href={item.href} className="gv-ds-card gv-ds-media-card">
              <img src={item.image} alt="" className="gv-ds-media-card__image" loading="lazy" />
              <div className="gv-ds-media-card__body">
                <HeadingM>{item.title}</HeadingM>
                <BodyM>{item.subtitle}</BodyM>
                <span className="gv-ds-media-card__arrow">View breakdown →</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="insider-preview-cta">
          <Button href="/vault/film-room" variant="secondary">
            View All Film Room
          </Button>
        </div>
      </Container>
    </Section>
  );
}
