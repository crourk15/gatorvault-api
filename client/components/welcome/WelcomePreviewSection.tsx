'use client';

import React from 'react';
import { WELCOME_COPY } from '@/lib/welcome-copy';

type Card = { title: string; body: string; href?: string };

function PreviewCard({ card }: { card: Card }): React.ReactElement {
  const inner = (
    <>
      <h3>{card.title}</h3>
      <p>{card.body}</p>
    </>
  );

  if (card.href) {
    return (
      <a href={card.href} className="welcome-card">
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
  const { futurecast } = WELCOME_COPY;
  return (
    <WelcomePreviewSection
      id="welcome-futurecast"
      title={futurecast.title}
      subtitle={futurecast.subtitle}
      body={futurecast.body}
      cards={futurecast.cards}
    />
  );
}

export function RecruitingHubPreview(): React.ReactElement {
  const { recruiting } = WELCOME_COPY;
  return (
    <WelcomePreviewSection
      id="welcome-recruiting"
      title={recruiting.title}
      subtitle={recruiting.subtitle}
      cards={recruiting.cards}
    />
  );
}

export function FilmRoomPreview(): React.ReactElement {
  const { filmRoom } = WELCOME_COPY;
  return (
    <WelcomePreviewSection
      id="welcome-film-room"
      title={filmRoom.title}
      subtitle={filmRoom.subtitle}
      body={filmRoom.body}
      cards={filmRoom.cards}
    />
  );
}

export function InsiderBenefits(): React.ReactElement {
  const { insider } = WELCOME_COPY;
  return (
    <WelcomePreviewSection
      id="welcome-insider"
      title={insider.title}
      subtitle={insider.subtitle}
      body={insider.body}
      cards={insider.cards}
      variant="insider"
    />
  );
}
