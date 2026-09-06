#!/usr/bin/env node
/**
 * Persist a GatorVault weekly Film Review so Film Room picks it up live
 * via GET /api/film-room/reviews — no Codemagic after the 1.0.23 fetch bake.
 *
 * Live gate: filmWatched:true AND watchStandard of broadcast|all22.
 * Official PBP drafts stay off the fan rail. Do not upsert a live review
 * until the Florida broadcast or All-22 has actually been watched.
 *
 * Usage:
 *   node server/scripts/upsert-vault-film-review.js \
 *     --file=server/data/film-room/reviews/week-1-fau-2026.json
 *
 * Confirm:
 *   node -e "console.log(require('./server/lib/vault-film-review-store').toApiPayload())"
 */
'use strict';

const fs = require('fs');
const path = require('path');
const store = require('../lib/vault-film-review-store');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function loadFromFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function main() {
  const file = argValue('--file');
  if (!file) {
    console.error('Usage: node server/scripts/upsert-vault-film-review.js --file=server/data/film-room/reviews/<id>.json');
    process.exit(1);
  }
  const raw = loadFromFile(file);
  const saved = store.upsertReview(raw);
  const live = store.listLiveReviews();
  console.log(
    JSON.stringify(
      {
        ok: true,
        id: saved.review.id,
        live: saved.live,
        watchStandard: saved.review.watchStandard,
        filmWatched: saved.review.filmWatched,
        fanVisible: live.some((row) => row.id === saved.review.id),
        liveCount: live.length,
        paths: saved.paths,
      },
      null,
      2
    )
  );
  if (!saved.live) {
    console.error('Saved as draft — fan rail still hidden until filmWatched + broadcast|all22.');
  }
}

main();
