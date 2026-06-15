'use client';

import React from 'react';
import { welcomeContent } from './content';
import { welcomeCardHref } from './links';

type Card = { title: string; body: string };

function PreviewCard({ card }: { card: Card }): React.ReactElement {
  const href = welcomeCardHref(card.title);
  const inner = (
    <>
      <h3>{card.title}</h3>
      <p>{card.body}</p>
    </>
  );

  if (href) {
    return (
      <a href={href} className="welcome-card">
        {inner}
      </a>
    );
  }

  return <article className="welcome-card">{inner}</article>;
}

type Props = {
  id: string;
  title: string;
  subtitle: string;
  body?: string;
  cards: readonly Card[];
  variant?: 'default' | 'insider';
};

export function WelcomePreviewSection({
  id,
  title,
  subtitle,
  body,
  cards,
  variant = 'default',
}: Props): React.ReactElement {
  return (
    <section
      id={id}
      className={`welcome-section${variant === 'insider' ? ' welcome-insider' : ''}`}
      data-testid={id}
    >
      <div className="welcome-section-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {body ? <p className="welcome-section-body">{body}</p> : null}
      </div>
      <div className="welcome-section-grid">
        {cards.map((card) => (
          <PreviewCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

export function FutureCastPreview(): React.ReactElement {
  const section = welcomeContent.sections.futurecast;
  return (
    <WelcomePreviewSection
      id="futurecast-preview"
      title={section.title}
      subtitle={section.subtitle}
      body={section.body}
      cards={section.cards}
    />
  );
}

export function RecruitingHubPreview(): React.ReactElement {
  const section = welcomeContent.sections.hub;
  return (
    <WelcomePreviewSection
      id="recruiting-preview"
      title={section.title}
      subtitle={section.subtitle}
      cards={section.cards}
    />
  );
}

export function FilmRoomPreview(): React.ReactElement {
  const section = welcomeContent.sections.filmRoom;
  return (
    <WelcomePreviewSection
      id="film-preview"
      title={section.title}
      subtitle={section.subtitle}
      body={section.body}
      cards={section.cards}
    />
  );
}

export function InsiderBenefits(): React.ReactElement {
  const section = welcomeContent.sections.insider;
  return (
    <WelcomePreviewSection
      id="welcome-insider"
      title={section.title}
      subtitle={section.subtitle}
      body={section.body}
      cards={section.cards}
      variant="insider"
    />
  );
}
