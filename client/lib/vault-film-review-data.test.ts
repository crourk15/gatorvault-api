import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEME_SCHOOL_LESSONS, schemeSchoolLesson } from './scheme-school-data';
import { normalizeFilmHub } from './film-room-api';
import { parseFilmRoomSegmentFromPath } from './vault-route-map';
import {
  VAULT_FILM_REVIEWS,
  latestVaultFilmReview,
  vaultFilmReview,
  vaultReviewHref,
  watchStandardLabel,
} from './vault-film-review-data';

describe('GatorVault Film Review', () => {
  it('ships Week 1 FAU from official PBP with last names', () => {
    const review = vaultFilmReview('week-1-fau');
    assert.ok(review);
    assert.equal(review.finalUF, 66);
    assert.equal(review.finalOpp, 21);
    assert.equal(review.filmWatched, true);
    assert.equal(review.watchStandard, 'official-pbp');
    assert.match(review.watchNote, /All-22 were not this desk/i);
    assert.match(review.offense.body, /Philo/);
    assert.match(review.offense.body, /Baugh/);
    assert.match(review.defense.body, /Coleman/);
    assert.match(review.defense.body, /Veltkamp/);
    assert.ok(review.schemeLessonIds.every((id) => schemeSchoolLesson(id)));
    assert.equal(latestVaultFilmReview()?.id, 'week-1-fau');
    assert.equal(vaultReviewHref('week-1-fau'), '/vault/film-room/review?review=week-1-fau');
    assert.equal(watchStandardLabel('official-pbp'), 'Official PBP charted');
    assert.equal(VAULT_FILM_REVIEWS.length, 1);
  });

  it('does not dump GNFP film review into the Vault rail', () => {
    assert.equal(normalizeFilmHub('GNFP Film Review'), 'Film Breakdown');
    assert.equal(normalizeFilmHub('Film Guy Network'), 'Film Breakdown');
    assert.equal(normalizeFilmHub('GatorVault Review'), 'GatorVault Review');
    assert.equal(normalizeFilmHub('GatorVault Film Review'), 'GatorVault Review');
    assert.equal(normalizeFilmHub('Our Tape'), 'GatorVault Review');
  });

  it('parses /film-room/review as the Vault rail', () => {
    assert.equal(parseFilmRoomSegmentFromPath('/vault/film-room/review'), 'review');
    assert.equal(parseFilmRoomSegmentFromPath('/film-room/review'), 'review');
    assert.equal(parseFilmRoomSegmentFromPath('/vault/film-room/breakdowns'), 'breakdowns');
  });

  it('keeps Scheme School staff-accurate and elite fields filled', () => {
    assert.ok(SCHEME_SCHOOL_LESSONS.every((lesson) => lesson.callSheet && lesson.saturdayTell));
    assert.ok(SCHEME_SCHOOL_LESSONS.every((lesson) => lesson.whatWins && lesson.whatLoses));
    const ol = schemeSchoolLesson('ss-ol-technique');
    assert.ok(ol);
    assert.match(ol.staff, /Phil Trautwein — Offensive Line/);
  });
});
