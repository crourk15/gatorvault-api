import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEME_SCHOOL_LESSONS, schemeSchoolLesson } from './scheme-school-data';
import { normalizeFilmHub } from './film-room-api';
import { parseFilmRoomSegmentFromPath } from './vault-route-map';
import {
  VAULT_FILM_REVIEWS,
  isLiveVaultFilmReview,
  latestVaultFilmReview,
  liveVaultFilmReviews,
  vaultFilmReview,
  vaultReviewHref,
} from './vault-film-review-data';

describe('GatorVault Film Review', () => {
  it('keeps the fan rail empty until a real Florida tape watch', () => {
    assert.deepEqual(VAULT_FILM_REVIEWS, []);
    assert.deepEqual(liveVaultFilmReviews(), []);
    assert.equal(latestVaultFilmReview(), undefined);
    assert.equal(vaultFilmReview('week-1-fau'), undefined);
    assert.equal(vaultReviewHref(), '/vault/film-room/review');
    assert.equal(
      isLiveVaultFilmReview({
        id: 'draft',
        week: 1,
        season: 2026,
        gameId: 'fau',
        opponent: 'FAU',
        opponentShort: 'FAU',
        dateLabel: 'x',
        venue: 'x',
        finalUF: 66,
        finalOpp: 21,
        title: 'x',
        dek: 'x',
        filmWatched: true,
        watchStandard: 'official-pbp',
        watchNote: 'x',
        sources: [],
        headline: 'x',
        offense: { kicker: 'x', body: 'x', bullets: [] },
        defense: { kicker: 'x', body: 'x', bullets: [] },
        specials: { kicker: 'x', body: 'x', bullets: [] },
        keys: [],
        schemeLessonIds: [],
        nextWeek: { opponent: 'x', look: 'x' },
        publishedAt: '2026-09-06T00:00:00Z',
      }),
      false
    );
  });

  it('does not dump GNFP film review into the Vault rail', () => {
    assert.equal(normalizeFilmHub('GNFP Film Review'), 'Film Breakdown');
    assert.equal(normalizeFilmHub('Film Guy Network'), 'Film Breakdown');
    assert.equal(normalizeFilmHub('GatorVault Review'), 'GatorVault Review');
    assert.equal(normalizeFilmHub('GatorVault Film Review'), 'GatorVault Review');
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
