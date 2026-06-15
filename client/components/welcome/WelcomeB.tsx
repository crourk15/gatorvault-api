'use client';

import React from 'react';
import { welcomeContent } from './content';
import { WELCOME_LINKS, welcomeCardHref } from './links';
import { InsiderComparisonTable } from '@/components/InsiderComparisonTable';
import { WelcomeStickyCTA } from './FooterCTA';

type SectionContent = {
  title: string;
  subtitle: string;
  body?: string;
  cards: readonly { title: string; body: string }[];
};

type FooterContent = {
  title: string;
  subtitle: string;
  ctas: { primary: string; secondary: string };
};

/** Variant B — Elite Light Mode (UF-blue marketing theme). */
export function WelcomeB(): React.ReactElement {
  const { sections } = welcomeContent;

  return (
    <div className="welcome welcome-bright" data-testid="welcome-page" data-welcome-variant="B">
      <HeroSectionBright />
      <SectionBright id="futurecast-preview" content={sections.futurecast} />
      <SectionBright id="recruiting-preview" content={sections.hub} />
      <SectionBright id="film-preview" content={sections.filmRoom} />
      <SectionBright id="insider-preview" content={sections.insider} />
      <InsiderComparisonTable />
      <FooterBright content={sections.footer} />
      <WelcomeStickyCTA />
    </div>
  );
}

function HeroSectionBright(): React.ReactElement {
  const { title, subtitle, stats, ctas, previewCards } = welcomeContent.hero;

  return (
    <section className="welcome-hero-bright" data-testid="welcome-hero-bright">
      <div className="welcome-hero-inner-bright">
        <div className="welcome-hero-copy-bright">
          <h1 className="welcome-hero-title-bright">{title}</h1>
          <p className="welcome-hero-subtitle-bright">{subtitle}</p>
          <div className="welcome-hero-cta-bright">
            <a href={WELCOME_LINKS.join} className="welcome-cta-primary-bright">
              {ctas.primary}
            </a>
            <a href={WELCOME_LINKS.futurecast} className="welcome-cta-secondary-bright">
              {ctas.secondary}
            </a>
          </div>
          <div className="welcome-hero-stats-bright">
            {stats.map((stat) => (
              <div key={stat} className="welcome-stat-bright">
                {stat}
              </div>
            ))}
          </div>
        </div>

        <div className="welcome-hero-preview-bright">
          {previewCards.map((card) => {
            const href = welcomeCardHref(card.title);
            const inner = (
              <>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </>
            );
            if (href) {
              return (
                <a key={card.title} href={href} className="welcome-hero-card-bright">
                  {inner}
                </a>
              );
            }
            return (
              <div key={card.title} className="welcome-hero-card-bright">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SectionBright({
  id,
  content,
}: {
  id: string;
  content: SectionContent;
}): React.ReactElement {
  return (
    <section id={id} className="welcome-section-bright" data-testid={id}>
      <div className="welcome-section-header-bright">
        <h2>{content.title}</h2>
        <p>{content.subtitle}</p>
        {content.body ? <p className="welcome-section-body-bright">{content.body}</p> : null}
      </div>
      <div className="welcome-section-grid-bright">
        {content.cards.map((card) => {
          const href = welcomeCardHref(card.title);
          const inner = (
            <>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </>
          );
          if (href) {
            return (
              <a key={card.title} href={href} className="welcome-card-bright">
                {inner}
              </a>
            );
          }
          return (
            <div key={card.title} className="welcome-card-bright">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FooterBright({ content }: { content: FooterContent }): React.ReactElement {
  return (
    <section className="welcome-footer-bright" data-testid="welcome-footer-bright">
      <div className="welcome-footer-inner-bright">
        <h2>{content.title}</h2>
        <p>{content.subtitle}</p>
        <div className="welcome-footer-cta-bright">
          <a href={WELCOME_LINKS.join} className="welcome-cta-primary-bright">
            {content.ctas.primary}
          </a>
          <a href={WELCOME_LINKS.join} className="welcome-cta-secondary-bright">
            {content.ctas.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
