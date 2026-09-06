'use client';

import React, { useState } from 'react';
import { PageSection } from '@/components/brand';
import {
  liveVaultFilmReviews,
  latestVaultFilmReview,
  watchStandardLabel,
  type FilmReviewUnitId,
  type VaultFilmReview,
} from '@/lib/vault-film-review-data';
import { schemeSchoolLesson } from '@/lib/scheme-school-data';

const UNIT_TABS: { id: FilmReviewUnitId; label: string }[] = [
  { id: 'offense', label: 'Offense' },
  { id: 'defense', label: 'Defense' },
  { id: 'specials', label: 'Specials' },
];

export function VaultFilmReviewGrid({
  insider,
  onOpen,
  onUnlock,
}: {
  insider: boolean;
  onOpen: (review: VaultFilmReview) => void;
  onUnlock: () => void;
}): React.ReactElement {
  const live = liveVaultFilmReviews();
  const featured = latestVaultFilmReview();
  const rest = live.filter((review) => review.id !== featured?.id);

  if (!featured) {
    return (
      <div className="gv-fr-review" data-testid="gv-fr-review-grid">
        <article className="gv-fr-review-hero" data-testid="gv-fr-review-waiting">
          <div className="gv-fr-review-hero__top">
            <span className="gv-fr-review-hero__badge">Our board</span>
            <p className="gv-fr-review-hero__watch">Waiting on tape</p>
          </div>
          <h3 className="gv-fr-review-hero__title">Week 1 vs FAU</h3>
          <p className="gv-fr-review-hero__dek">
            The GatorVault review lands after we watch the Florida tape. Official score is on the board.
            This rail stays empty until that watch.
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

export function VaultFilmReviewViewer({
  review,
  onClose,
  onOpenScheme,
}: {
  review: VaultFilmReview;
  onClose: () => void;
  onOpenScheme: (lessonId: string) => void;
}): React.ReactElement {
  const [unit, setUnit] = useState<FilmReviewUnitId>('offense');
  const block = review[unit];
  const bodyParas = block.body.split(/\n\n+/).filter((para) => para.trim());

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
            {watchStandardLabel(review.watchStandard)} · {review.dateLabel}
          </p>
        </div>
        <p className="gv-film-lesson__dek">{review.headline}</p>
        <p className="gv-film-lesson__type">{review.watchNote}</p>
        <div className="gv-fr-review-tabs" role="tablist" aria-label="Review units">
          {UNIT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={unit === tab.id}
              className={`gv-fr-review-tabs__btn${unit === tab.id ? ' is-active' : ''}`}
              onClick={() => setUnit(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <section className="gv-fr-review-unit" aria-label={unit}>
          <p className="gv-fr-review-unit__kicker">{block.kicker}</p>
          {bodyParas.map((para) => (
            <p key={para.slice(0, 48)}>{para}</p>
          ))}
          <ul>
            {block.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>
        <section className="gv-fr-review-keys" aria-label="Keys">
          <p className="gv-fr-review-unit__kicker">The board</p>
          <ol>
            {review.keys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ol>
        </section>
        {review.schemeLessonIds.length ? (
          <section aria-label="How they ran it">
            <p className="gv-fr-review-unit__kicker">How they ran it</p>
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
        <section className="gv-fr-review-next">
          <p className="gv-fr-review-unit__kicker">Next · {review.nextWeek.opponent}</p>
          <p>{review.nextWeek.look}</p>
        </section>
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
