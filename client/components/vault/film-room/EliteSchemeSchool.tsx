'use client';

import React from 'react';
import { PageSection } from '@/components/brand';
import {
  SCHEME_SCHOOL_LESSONS,
  SCHEME_SCHOOL_UNITS,
  type SchemeSchoolLesson,
} from '@/lib/scheme-school-data';
import { type VaultFilmReview } from '@/lib/vault-film-review-data';

export function EliteSchemeSchoolGrid({
  latestReview,
  insider,
  onOpen,
  onUnlock,
}: {
  latestReview?: VaultFilmReview;
  insider: boolean;
  onOpen: (lesson: SchemeSchoolLesson) => void;
  onUnlock: () => void;
}): React.ReactElement {
  const review = latestReview;
  const featuredId = review?.schemeLessonIds[0];
  const featured = SCHEME_SCHOOL_LESSONS.find((lesson) => lesson.id === featuredId) || SCHEME_SCHOOL_LESSONS[0];

  return (
    <div className="gv-fr-scheme-elite" data-testid="gv-fr-scheme-elite">
      {featured ? (
        <article className="gv-fr-scheme-featured">
          <p className="gv-fr-scheme-featured__kicker">This week’s install</p>
          {review ? (
            <span className="gv-fr-scheme-featured__badge">Seen vs {review.opponentShort}</span>
          ) : (
            <span className="gv-fr-scheme-featured__badge">Call sheet</span>
          )}
          <h3 className="gv-fr-scheme-featured__title">{featured.title}</h3>
          <p className="gv-fr-scheme-featured__dek">{featured.callSheet}</p>
          <div className="gv-fr-scheme-featured__row">
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
              {insider ? 'Open install' : 'Unlock'}
            </button>
          </div>
        </article>
      ) : null}

      {SCHEME_SCHOOL_UNITS.map((unit) => {
        const lessons = SCHEME_SCHOOL_LESSONS.filter((lesson) => lesson.unit === unit.id);
        return (
          <section key={unit.id} className="gv-fr-scheme-unit">
            <header className="gv-fr-scheme-unit__identity">
              <p className="gv-fr-scheme-unit__staff">{unit.staff}</p>
              <h3 className="gv-fr-scheme-unit__title">{unit.label}</h3>
              <p className="gv-fr-scheme-unit__dek">{unit.dek}</p>
            </header>
            <div className="gv-fr-grid gv-fr-grid--scheme">
              {lessons.map((lesson) => (
                <article key={lesson.id} className="gv-fr-scheme-card">
                  <button
                    type="button"
                    className="gv-fr-scheme-card__btn"
                    onClick={() => {
                      if (!insider) {
                        onUnlock();
                        return;
                      }
                      onOpen(lesson);
                    }}
                  >
                    <span className="gv-fr-scheme-card__badge">{unit.label}</span>
                    <h3 className="gv-fr-scheme-card__title">{lesson.title}</h3>
                    <p className="gv-fr-scheme-card__call">{lesson.callSheet}</p>
                    <p className="gv-fr-scheme-card__tell">{lesson.saturdayTell}</p>
                    <p className="gv-fr-scheme-card__meta">{lesson.staff}</p>
                    <span className="gv-fr-scheme-card__cta">{insider ? 'Open install' : 'Unlock'}</span>
                  </button>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function EliteSchemeSchoolViewer({
  lesson,
  seenVs,
  onClose,
  onOpenRelated,
  onOpenReview,
}: {
  lesson: SchemeSchoolLesson;
  seenVs?: string | null;
  onClose: () => void;
  onOpenRelated: (lesson: SchemeSchoolLesson) => void;
  onOpenReview?: () => void;
}): React.ReactElement {
  return (
    <PageSection title={lesson.title} subtitle={lesson.staff}>
      <button type="button" className="gv-film-lesson__back" onClick={onClose}>
        ← Back to Scheme School
      </button>
      <p className="gv-fr-scheme-viewer__kicker">Install</p>
      <p className="gv-fr-scheme-viewer__staff">{lesson.staff}</p>
      {seenVs ? (
        <p className="gv-fr-scheme-viewer__seen">
          On the board vs {seenVs}
          {onOpenReview ? (
            <>
              {' '}
              <button type="button" className="gv-fr-review-scheme__btn" onClick={onOpenReview}>
                Open review
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="gv-film-lesson__dek">{lesson.callSheet}</p>
      <p className="gv-film-lesson__type">{lesson.whenUFUses}</p>
      <div className="gv-film-lesson__body">
        <p>{lesson.body}</p>
      </div>
      <div className="gv-fr-scheme-viewer__grid">
        <section className="gv-fr-scheme-viewer__panel">
          <p className="gv-fr-review-unit__kicker">What wins</p>
          <p>{lesson.whatWins}</p>
        </section>
        <section className="gv-fr-scheme-viewer__panel">
          <p className="gv-fr-review-unit__kicker">What dies</p>
          <p>{lesson.whatLoses}</p>
        </section>
      </div>
      <section className="gv-fr-scheme-viewer__panel">
        <p className="gv-fr-review-unit__kicker">Saturday tell</p>
        <p>{lesson.saturdayTell}</p>
      </section>
      <div className="gv-fr-scheme-viewer__watch">
        <h4>What to watch for</h4>
        <ul>
          {lesson.watchFor.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {lesson.relatedIds.length ? (
        <div className="gv-fr-review-scheme" style={{ marginTop: '1rem' }}>
          {lesson.relatedIds.map((id) => {
            const related = SCHEME_SCHOOL_LESSONS.find((entry) => entry.id === id);
            if (!related) return null;
            return (
              <button
                key={id}
                type="button"
                className="gv-fr-scheme-related__btn"
                onClick={() => onOpenRelated(related)}
              >
                {related.title}
              </button>
            );
          })}
        </div>
      ) : null}
    </PageSection>
  );
}
