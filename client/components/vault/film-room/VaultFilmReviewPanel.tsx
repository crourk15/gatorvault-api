'use client';

import React from 'react';
import { PageSection } from '@/components/brand';
import {
  liveVaultFilmReviews,
  latestVaultFilmReview,
  watchStandardLabel,
  type FilmReviewUnitId,
  type VaultFilmReview,
} from '@/lib/vault-film-review-data';
import { schemeSchoolLesson } from '@/lib/scheme-school-data';

const UNITS: { id: FilmReviewUnitId; label: string }[] = [
  { id: 'offense', label: 'Offense' },
  { id: 'defense', label: 'Defense' },
  { id: 'specials', label: 'Specials' },
];

function paragraphs(text: string): string[] {
  return String(text || '')
    .split(/\n\n+/)
    .map((para) => para.trim())
    .filter(Boolean);
}

export function VaultFilmReviewGrid({
  reviews = [],
  insider,
  onOpen,
  onUnlock,
}: {
  reviews?: VaultFilmReview[];
  insider: boolean;
  onOpen: (review: VaultFilmReview) => void;
  onUnlock: () => void;
}): React.ReactElement {
  const live = liveVaultFilmReviews(reviews);
  const featured = latestVaultFilmReview(reviews);
  const rest = live.filter((review) => review.id !== featured?.id);

  if (!featured) {
    return (
      <div className="gv-fr-review" data-testid="gv-fr-review-grid">
        <article className="gv-fr-review-hero" data-testid="gv-fr-review-waiting">
          <div className="gv-fr-review-hero__top">
            <span className="gv-fr-review-hero__badge">Our board</span>
          </div>
          <h3 className="gv-fr-review-hero__title">GatorVault Film Review</h3>
          <p className="gv-fr-review-hero__dek">
            Offense, defense, and specials after we watch. This rail is empty until a board is live.
          </p>
        </article>
      </div>
    );
  }

  return (
    <div className="gv-fr-review" data-testid="gv-fr-review-grid">
      <article className="gv-fr-review-hero" data-testid="gv-fr-review-featured">
        <div className="gv-fr-review-hero__top">
          <span className="gv-fr-review-hero__badge">Our board</span>
          <p className="gv-fr-review-hero__watch">{watchStandardLabel(featured.watchStandard)}</p>
        </div>
        <h3 className="gv-fr-review-hero__title">{featured.title}</h3>
        <p className="gv-fr-review-hero__score">
          Florida {featured.finalUF} <span>·</span> {featured.opponentShort} {featured.finalOpp}
        </p>
        <p className="gv-fr-review-hero__dek">{featured.dek}</p>
        <button
          type="button"
          className="gv-fr-review-hero__cta"
          onClick={() => {
            if (!insider) {
              onUnlock();
              return;
            }
            onOpen(featured);
          }}
        >
          {insider ? 'Open review' : 'Unlock'}
        </button>
      </article>
      {rest.length ? (
        <div className="gv-fr-review-list">
          {rest.map((review) => (
            <article key={review.id} className="gv-fr-review-card">
              <button
                type="button"
                className="gv-fr-review-card__btn"
                onClick={() => {
                  if (!insider) {
                    onUnlock();
                    return;
                  }
                  onOpen(review);
                }}
              >
                <div className="gv-fr-review-card__week">
                  <b>Wk {review.week}</b>
                  <span>{review.season}</span>
                </div>
                <div>
                  <h3 className="gv-fr-review-card__title">{review.title}</h3>
                  <p className="gv-fr-review-card__dek">{review.dek}</p>
                </div>
                <p className="gv-fr-review-card__score">
                  {review.finalUF}–{review.finalOpp}
                </p>
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReviewUnit({
  label,
  body,
  bullets = [],
}: {
  label: string;
  body: string;
  bullets?: string[];
}): React.ReactElement | null {
  const paras = paragraphs(body);
  if (!paras.length && !bullets.length) return null;
  return (
    <section className="gv-fr-review-unit" aria-label={label}>
      <p className="gv-fr-review-unit__kicker">{label}</p>
      {paras.map((para) => (
        <p key={para.slice(0, 48)}>{para}</p>
      ))}
      {bullets.length ? (
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function VaultFilmReviewViewer({
  review,
  onClose,
  onOpenScheme,
}: {
  review: VaultFilmReview;
  onClose: () => void;
  onOpenScheme: (lessonId: string) => void;
}): React.ReactElement {
  const recap = paragraphs(review.recap);
  const held = review.held.length ? review.held : [];
  const opportunity = review.opportunity.length ? review.opportunity : [];

  return (
    <PageSection title={review.title} subtitle="GatorVault Film Review">
      <div className="gv-fr-review-viewer" data-testid="gv-fr-review-viewer">
        <button type="button" className="gv-film-lesson__back" onClick={onClose}>
          ← Back to GatorVault Review
        </button>
        <div className="gv-fr-review-viewer__scoreboard">
          <strong>
            Florida {review.finalUF} · {review.opponentShort} {review.finalOpp}
          </strong>
          <p className="gv-fr-review-viewer__meta">
            {review.dateLabel}
            {review.venue ? ` · ${review.venue}` : ''}
          </p>
        </div>
        {recap.length ? (
          <section className="gv-fr-review-unit gv-fr-review-unit--lead" aria-label="Recap">
            {recap.map((para) => (
              <p key={para.slice(0, 48)}>{para}</p>
            ))}
          </section>
        ) : null}
        {UNITS.map((unit) => {
          const block = review[unit.id];
          return (
            <ReviewUnit
              key={unit.id}
              label={block.kicker || unit.label}
              body={block.body}
              bullets={block.bullets}
            />
          );
        })}
        {held.length || opportunity.length ? (
          <div className="gv-fr-review-split">
            {held.length ? (
              <section className="gv-fr-review-keys" aria-label="What held">
                <p className="gv-fr-review-unit__kicker">What held</p>
                <ul>
                  {held.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {opportunity.length ? (
              <section className="gv-fr-review-keys" aria-label="Areas of opportunity">
                <p className="gv-fr-review-unit__kicker">Areas of opportunity</p>
                <ul>
                  {opportunity.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
        {review.schemeLessonIds.length ? (
          <section aria-label="Scheme School">
            <p className="gv-fr-review-unit__kicker">Scheme School</p>
            <div className="gv-fr-review-scheme">
              {review.schemeLessonIds.map((id) => {
                const lesson = schemeSchoolLesson(id);
                if (!lesson) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className="gv-fr-review-scheme__btn"
                    onClick={() => onOpenScheme(id)}
                  >
                    {lesson.title}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
        {review.nextWeek.look ? (
          <section className="gv-fr-review-next">
            <p className="gv-fr-review-unit__kicker">Next · {review.nextWeek.opponent}</p>
            <p>{review.nextWeek.look}</p>
          </section>
        ) : null}
        <p className="gv-fr-review-source">
          {review.sources.map((source, index) => (
            <span key={source.label}>
              {index ? ' · ' : ''}
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </span>
          ))}
        </p>
      </div>
    </PageSection>
  );
}
