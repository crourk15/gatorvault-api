/**
 * GatorVault Film Review — weekly authored Florida game board.
 * Breakdowns stay GNFP / Film Guy. This rail is our voice.
 *
 * Live rule: a review is fan-visible only after a real Florida tape watch
 * (broadcast or All-22). Official PBP / box drafts stay off the platform.
 */

export type FilmReviewWatchStandard = 'official-pbp' | 'broadcast' | 'all22';

export type FilmReviewUnitId = 'offense' | 'defense' | 'specials';

export type FilmReviewUnit = {
  kicker: string;
  body: string;
  bullets: string[];
};

export type VaultFilmReview = {
  id: string;
  week: number;
  season: number;
  gameId: string;
  opponent: string;
  opponentShort: string;
  dateLabel: string;
  venue: string;
  finalUF: number;
  finalOpp: number;
  title: string;
  dek: string;
  filmWatched: boolean;
  watchStandard: FilmReviewWatchStandard;
  watchNote: string;
  sources: { label: string; url?: string }[];
  headline: string;
  offense: FilmReviewUnit;
  defense: FilmReviewUnit;
  specials: FilmReviewUnit;
  keys: string[];
  schemeLessonIds: string[];
  nextWeek: { opponent: string; look: string };
  clipLabel?: string;
  clipUrl?: string;
  publishedAt: string;
};

export const VAULT_REVIEW_HUB = 'GatorVault Review';

/** Fan-visible reviews only. Empty until a real Florida tape watch lands. */
export const VAULT_FILM_REVIEWS: VaultFilmReview[] = [];

export function isLiveVaultFilmReview(review: VaultFilmReview): boolean {
  if (!review.filmWatched) return false;
  return review.watchStandard === 'broadcast' || review.watchStandard === 'all22';
}

export function liveVaultFilmReviews(reviews: VaultFilmReview[] = VAULT_FILM_REVIEWS): VaultFilmReview[] {
  return reviews.filter(isLiveVaultFilmReview);
}

export function vaultFilmReview(
  id: string,
  reviews: VaultFilmReview[] = VAULT_FILM_REVIEWS
): VaultFilmReview | undefined {
  return liveVaultFilmReviews(reviews).find((review) => review.id === id);
}

export function latestVaultFilmReview(
  reviews: VaultFilmReview[] = VAULT_FILM_REVIEWS
): VaultFilmReview | undefined {
  return [...liveVaultFilmReviews(reviews)].sort((a, b) => {
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    return tb - ta;
  })[0];
}

export function vaultFilmReviewForGame(
  gameId: string,
  reviews: VaultFilmReview[] = VAULT_FILM_REVIEWS
): VaultFilmReview | undefined {
  return liveVaultFilmReviews(reviews).find((review) => review.gameId === gameId);
}

export function vaultReviewHref(reviewId?: string, reviews: VaultFilmReview[] = VAULT_FILM_REVIEWS): string {
  const id = reviewId || latestVaultFilmReview(reviews)?.id;
  const base = '/vault/film-room/review';
  return id ? `${base}?review=${encodeURIComponent(id)}` : base;
}

export function watchStandardLabel(standard: FilmReviewWatchStandard): string {
  if (standard === 'all22') return 'All-22 watched';
  if (standard === 'broadcast') return 'Broadcast watched';
  return 'Official PBP charted';
}
