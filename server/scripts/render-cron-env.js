/**
 * Optional dotenv for Render crons — env vars are injected on Render; local dev uses server/.env.
 */
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch {
  /* dotenv unavailable before npm install — Render env is sufficient */
}