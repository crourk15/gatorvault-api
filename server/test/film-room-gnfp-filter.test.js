/**
 * Film Breakdown should keep GNFP tape reviews and drop coach podcast sit-downs.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isGnfpFilmBreakdownTitle,
  shouldKeepEntry,
  mergeBucket,
} = require('../lib/film-room-youtube-ingest');

const GNFP_SOURCE = { kind: 'gnfp', bucket: 'gnfp', label: 'GNFP' };

describe('GNFP Film Breakdown title filter', () => {
  it('keeps Film Review / Quick Film Review titles', () => {
    assert.equal(
      isGnfpFilmBreakdownTitle(
        'GNFP Film Review - 2026 Aaron Philo Analysis Part 2 | Florida Gators Offense'
      ),
      true
    );
    assert.equal(
      isGnfpFilmBreakdownTitle(
        'GNFP Quick Film Review - 2025 Florida Gators Offense vs Georgia | The Gator Nation Football Podcast'
      ),
      true
    );
  });

  it('drops Talking Ball / Podcast Episode coach conversations', () => {
    assert.equal(
      isGnfpFilmBreakdownTitle(
        'GNFP Podcast Episode- 2026 Talking Ball with Coach Jon Sumrall'
      ),
      false
    );
    assert.equal(shouldKeepEntry({ title: 'GNFP Podcast Episode- 2026 Talking Ball with Coach Jon Sumrall' }, GNFP_SOURCE), false);
  });

  it('prunes non-film rows from the gnfp merge bucket', () => {
    const existing = [
      {
        id: 'yt_S_tCZjoet48',
        title: 'GNFP Podcast Episode- 2026 Talking Ball with Coach Jon Sumrall',
        publishedAt: '2026-05-20T20:01:09.000Z',
      },
      {
        id: 'yt_keep',
        title: 'GNFP Film Review - 2026 Buster Faulkner Offense Part 1 | Florida Gators Offense',
        publishedAt: '2026-04-08T19:00:00.000Z',
      },
    ];
    const { rows } = mergeBucket(existing, [], { pruneGnfpNonFilm: true });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'yt_keep');
  });
});
