'use client';

import React from 'react';
import { Button, Container, HeadingL, HeadingM, BodyM, Section } from '@/components/ui';

const INTEL_CARDS = [
  {
    tag: 'intel' as const,
    label: 'Insider Intel',
    title: 'Staff confidence rising on 2027 OT target',
    body: 'Multiple sources indicate increased staff interest after recent visit.',
  },
  {
    tag: 'recruiting' as const,
    label: 'Recruiting Notes',
    title: 'Priority board shuffle ahead of summer camps',
    body: 'Three names moved into the top tier after spring evaluations.',
  },
  {
    tag: 'portal' as const,
    label: 'Portal Watch',
    title: 'Portal window: UF monitoring two SEC transfers',
    body: 'Insider tracker shows active evaluation on edge and safety positions.',
  },
] as const;

const TAG_CLASS = {
  intel: 'insider-war-card__tag--intel',
  recruiting: 'insider-war-card__tag--recruiting',
  portal: 'insider-war-card__tag--portal',
} as const;

export function WarRoomPreviewSection(): React.ReactElement {
  return (
    <Section className="insider-section" data-testid="insider-war-room">
      <Container>
        <div className="insider-section__header">
          <HeadingL>War Room Preview</HeadingL>
          <BodyM>Insider intel cards and recruiting notes from the war room.</BodyM>
        </div>
        <div className="insider-preview-grid">
          {INTEL_CARDS.map((card) => (
            <article key={card.title} className="gv-ds-card insider-war-card">
              <span className={`insider-war-card__tag ${TAG_CLASS[card.tag]}`}>{card.label}</span>
              <HeadingM>{card.title}</HeadingM>
              <BodyM>{card.body}</BodyM>
            </article>
          ))}
        </div>
        <div className="insider-preview-cta">
          <Button href="/vault/futurecast/staff" variant="primary">
            Enter War Room
          </Button>
        </div>
      </Container>
    </Section>
  );
}
