#!/usr/bin/env node
/**
 * Official Gators Football highlight ingest (YouTube RSS).
 * Same sync as pressers — Game Highlights titles land in the Highlights hub.
 * Usage: node scripts/weekly/weekly-highlights-ingest.js
 */
const { syncFilmRoomYouTube } = require('../../lib/film-room-youtube-ingest');

syncFilmRoomYouTube()
  .then((result) => {
    console.log('[weekly-highlights-ingest]', JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('[weekly-highlights-ingest] FATAL', err.message);
    process.exit(1);
  });
