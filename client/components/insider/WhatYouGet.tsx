'use client';

import React from 'react';
import { Container, FeatureCard, Grid2, HeadingL, BodyL, Section } from '@/components/ui';

const BENEFITS = [
  {
    icon: '🎬',
    title: 'Film Room',
    description: 'Highlights, cut-ups, and staff-style player evaluations for every major target.',
    href: '/vault/film-room',
  },
  {
    icon: '🛡️',
    title: 'War Room Intel',
    description: 'Insider notes, confidence scores, and recruiting feel from the war room.',
    href: '/vault/futurecast/staff',
  },
  {
    icon: '💬',
    title: 'Insider Chat',
    description: 'Real-time insider discussion with fellow Gators fans and analysts.',
    href: '/insider',
  },
  {
    icon: '📊',
    title: 'NIL + Portal Tracker',
    description: 'Full portal movement, NIL intel, and staff interest levels in one hub.',
    href: '/vault/portal',
  },
] as const;

export function WhatYouGet(): React.ReactElement {
  return (
    <Section className="insider-section" data-testid="insider-what-you-get">
      <Container>
        <div className="insider-section__header">
          <HeadingL>What You Get</HeadingL>
          <BodyL>Everything you need to stay ahead of Florida recruiting.</BodyL>
        </div>
        <Grid2>
          {BENEFITS.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </Grid2>
      </Container>
    </Section>
  );
}
