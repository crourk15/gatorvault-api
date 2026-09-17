const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseRssEntries,
  shouldKeepEntry,
  mergeBucket,
  toCacheRow,
  isCurrentStaffGnfpReview,
} = require('../../lib/film-room-youtube-ingest');

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <entry>
  <yt:videoId>abcABCabcAB</yt:videoId>
  <title>Florida Football Press Conference | Jon Sumrall</title>
  <published>2026-07-22T15:00:00+00:00</published>
  <media:group>
   <media:thumbnail url="https://i.ytimg.com/vi/abcABCabcAB/hqdefault.jpg" width="480" height="360"/>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>soccerSoccer1</yt:videoId>
  <title>Florida Soccer | Coach Zimmerman Press Conference</title>
  <published>2026-07-17T15:00:00+00:00</published>
 </entry>
</feed>`;

test('parseRssEntries extracts youtube ids and titles', () => {
  const entries = parseRssEntries(sampleXml);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].youtubeId, 'abcABCabcAB');
  assert.match(entries[0].title, /Sumrall/);
});

test('shouldKeepEntry keeps football pressers and drops soccer', () => {
  const florida = { kind: 'florida_official', bucket: 'pressers', label: 'Florida Gators YouTube' };
  const keep = { title: 'Florida Football Press Conference | Jon Sumrall' };
  const drop = { title: 'Florida Soccer | Coach Zimmerman Press Conference' };
  assert.equal(shouldKeepEntry(keep, florida), true);
  assert.equal(shouldKeepEntry(drop, florida), false);
});

test('shouldKeepEntry keeps official game highlights on the football channel', () => {
  const football = { kind: 'gators_football', bucket: 'pressers', label: 'Florida Gators Football' };
  const keep = { title: 'Game Highlights | Week One | Florida vs. FAU' };
  const trailer = { title: 'Only Gators Get Out Alive | 2026 Season Trailer' };
  const micd = { title: "Mic'd Up with Florida Running Back Jadan Baugh" };
  assert.equal(shouldKeepEntry(keep, football), true);
  assert.equal(shouldKeepEntry(trailer, football), false);
  assert.equal(shouldKeepEntry(micd, football), false);
});

test('mergeBucket adds new ids only once', () => {
  const source = { bucket: 'pressers', label: 'Florida Gators YouTube', kind: 'florida_official' };
  const row = toCacheRow({
    youtubeId: 'abcABCabcAB',
    title: 'Florida Football Press Conference | Jon Sumrall',
    publishedAt: '2026-07-22T15:00:00.000Z',
    thumbUrl: 'https://i.ytimg.com/vi/abcABCabcAB/hqdefault.jpg',
  }, source);
  const first = mergeBucket([], [row]);
  assert.equal(first.added, 1);
  const second = mergeBucket(first.rows, [row]);
  assert.equal(second.added, 0);
  assert.equal(second.rows.length, 1);
});

test('GNFP ingest keeps 2026 staff film and drops 2025 Napier-era reviews', () => {
  const gnfp = { kind: 'gnfp', bucket: 'gnfp', label: 'GNFP' };
  const keep = {
    title: 'GNFP Film Review- 2026 Florida Gators Offense vs. FAU',
    publishedAt: '2026-09-02T12:00:00.000Z',
  };
  const drop = {
    title: 'GNFP Film Review - 2025 Florida Gators Offense vs FSU | The Gator Nation Football Podcast',
    publishedAt: '2025-12-22T17:39:23.000Z',
    season: '2025',
  };
  assert.equal(isCurrentStaffGnfpReview(keep), true);
  assert.equal(isCurrentStaffGnfpReview(drop), false);
  assert.equal(shouldKeepEntry(keep, gnfp), true);
  assert.equal(shouldKeepEntry(drop, gnfp), false);

  const stale = toCacheRow(
    {
      youtubeId: 'old2025fsu11',
      title: drop.title,
      publishedAt: drop.publishedAt,
    },
    gnfp
  );
  const fresh = toCacheRow(
    {
      youtubeId: 'new2026fau11',
      title: keep.title,
      publishedAt: keep.publishedAt,
    },
    gnfp
  );
  const pruned = mergeBucket([stale, fresh], [], { pruneGnfpNonFilm: true });
  assert.equal(pruned.rows.length, 1);
  assert.equal(pruned.rows[0].youtubeId, 'new2026fau11');
});
