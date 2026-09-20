/**
 * GNFP Film Breakdown title filters — no network deps.
 * Codemagic client seed (`generate-film-room-hub-seed.js`) must load this
 * instead of film-room-youtube-ingest.js (that file talks to YouTube).
 */

/** Real film study — not coach sit-downs / podcast episodes. */
const GNFP_FILM_SIGNAL =
  /\b((?:quick\s+)?film\s+review|film\s+breakdown|film\s+study|film\s+analysis)\b/i;

/** Coach conversations / podcast eps that match "GNFP" but are not tape breakdown. */
const GNFP_PODCAST_CONVO =
  /\b(podcast\s*episode|talking\s*ball|sit[\s-]?down|q\s*&\s*a)\b/i;

function isGnfpFilmBreakdownTitle(title) {
  const t = String(title || '');
  if (!t) return false;
  if (GNFP_PODCAST_CONVO.test(t) && !GNFP_FILM_SIGNAL.test(t)) return false;
  return GNFP_FILM_SIGNAL.test(t);
}

/** Sumrall / Faulkner year — drop Napier-era 2025 GNFP film reviews. */
const CURRENT_STAFF_GNFP_SEASON = 2026;

function gnfpTitleSeason(title) {
  const years = [...String(title || '').matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  if (years.includes(CURRENT_STAFF_GNFP_SEASON)) return CURRENT_STAFF_GNFP_SEASON;
  if (years.includes(2025)) return 2025;
  return null;
}

function isCurrentStaffGnfpReview(rowOrTitle) {
  const row = rowOrTitle && typeof rowOrTitle === 'object' ? rowOrTitle : { title: rowOrTitle };
  const title = String(row.title || '');
  if (!isGnfpFilmBreakdownTitle(title)) return false;
  const titled = gnfpTitleSeason(title);
  if (titled != null) return titled >= CURRENT_STAFF_GNFP_SEASON;
  const seasonNum = Number(row.season);
  if (Number.isFinite(seasonNum) && seasonNum > 0) {
    return seasonNum >= CURRENT_STAFF_GNFP_SEASON;
  }
  const pub = row.publishedAt ? new Date(row.publishedAt).getUTCFullYear() : 0;
  if (Number.isFinite(pub) && pub > 0) return pub >= CURRENT_STAFF_GNFP_SEASON;
  return false;
}

module.exports = {
  GNFP_FILM_SIGNAL,
  GNFP_PODCAST_CONVO,
  isGnfpFilmBreakdownTitle,
  CURRENT_STAFF_GNFP_SEASON,
  gnfpTitleSeason,
  isCurrentStaffGnfpReview,
};
