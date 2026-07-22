#!/usr/bin/env node
/**
 * Weekly / on-demand UF press conference + GNFP film review ingest (YouTube RSS).
 * Usage: node scripts/weekly/weekly-pressers-ingest.js
 */
const { syncFilmRoomYouTube } = require('../../lib/film-room-youtube-ingest');

syncFilmRoomYouTube()
  .then((result) => {
    console.log('[weekly-pressers-ingest]', JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('[weekly-pressers-ingest] FATAL', err.message);
    process.exit(1);
  });
