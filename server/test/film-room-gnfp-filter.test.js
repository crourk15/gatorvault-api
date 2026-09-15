/**
 * Film Breakdown should keep GNFP tape reviews and drop coach podcast sit-downs.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isGnfpFilmBreakdownTitle,
  isFilmGuyFloridaBreakdownTitle,
  isOfficialHighlightTitle,
  isCondensedGameTitle,
  shouldKeepEntry,
  mergeBucket,
  DEFAULT_SOURCES,
} = require('../lib/film-room-youtube-ingest');
const { loadLegacyVideoCatalog } = require('../lib/film-room-legacy');

const GNFP_SOURCE = { kind: 'gnfp', bucket: 'gnfp', label: 'GNFP' };
const FILM_GUY_SOURCE = { kind: 'film_guy', bucket: 'filmGuy', label: 'Film Guy Network' };

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
    assert.equal(
      isGnfpFilmBreakdownTitle('GNFP Film Review- 2026 Florida Gators Offense vs. FAU'),
      true
    );
    assert.equal(
      isGnfpFilmBreakdownTitle(
        'GNFP Film Review- 2026 Florida Gators Defense vs. Florida Atlantic (FAU)'
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

describe('Film Guy UF football breakdowns only', () => {
  it('watches the Film Guy channel on default ingest', () => {
    assert.ok(
      DEFAULT_SOURCES.some(
        (s) => s.channelId === 'UCqipe2JOIQZke4AN3-K9DJA' && s.bucket === 'filmGuy'
      )
    );
  });

  it('keeps UF film studies and drops other teams / live / reactions', () => {
    assert.equal(
      isFilmGuyFloridaBreakdownTitle('FILM: I Can\'t Stop Studying Buster Faulkner Florida Offense'),
      true
    );
    assert.equal(
      isFilmGuyFloridaBreakdownTitle('Film Guy Network — Florida Spring Game Film Study'),
      true
    );
    assert.equal(
      isFilmGuyFloridaBreakdownTitle(
        'FILM: What Florida Should Expect From Buster Faulkner and Transfer QB, Aaron Philo'
      ),
      true
    );
    assert.equal(
      isFilmGuyFloridaBreakdownTitle('FILM: Ohio State vs Texas - How the Longhorns Came Back'),
      false
    );
    assert.equal(
      isFilmGuyFloridaBreakdownTitle('FILM: Georgia Looks Like An Absolute Wagon, Kicking The Can Like You Should'),
      false
    );
    assert.equal(
      isFilmGuyFloridaBreakdownTitle('FGN Live: CFB Week Two Reactions | How Good is Georgia Football?'),
      false
    );
    assert.equal(isFilmGuyFloridaBreakdownTitle('REACTION: Texas Makes INSANE Comeback'), false);
    assert.equal(
      isFilmGuyFloridaBreakdownTitle('Alabama Crimson Tide vs Kentuccky Wildcats Score Predictions'),
      false
    );
    assert.equal(isFilmGuyFloridaBreakdownTitle('FILM: Florida Atlantic Offense vs Memphis'), false);
    assert.equal(
      shouldKeepEntry({ title: 'FILM: Ohio State vs Texas - What To Expect' }, FILM_GUY_SOURCE),
      false
    );
    assert.equal(
      shouldKeepEntry(
        { title: 'FILM: I Can\'t Stop Studying Buster Faulkner Florida Offense' },
        FILM_GUY_SOURCE
      ),
      true
    );
  });

  it('prunes non-Florida Film Guy rows from the merge bucket', () => {
    const existing = [
      {
        id: 'yt_texas',
        title: 'FILM: Ohio State vs Texas - How the Longhorns Came Back',
        publishedAt: '2026-09-14T14:26:17.000Z',
      },
      {
        id: 'yt_uf',
        title: 'FILM: I Can\'t Stop Studying Buster Faulkner Florida Offense',
        publishedAt: '2026-09-07T16:00:00.000Z',
      },
    ];
    const { rows } = mergeBucket(existing, [], { pruneFilmGuyNonFlorida: true });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'yt_uf');
  });

  it('includes the Faulkner Week 1 Film Guy study', () => {
    const items = loadLegacyVideoCatalog();
    const row = items.find((i) => i.youtubeId === 'Y1FxeyDmPmk');
    assert.ok(row, 'Y1FxeyDmPmk missing from Film Room catalog');
    assert.match(String(row.source || ''), /Film Guy/i);
    assert.match(String(row.title || ''), /Buster Faulkner/i);
  });
});

describe('Highlights drop condensed games', () => {
  it('keeps official cuts and rejects condensed titles', () => {
    assert.equal(isOfficialHighlightTitle('Game Highlights | Week One | Florida vs. FAU'), true);
    assert.equal(isCondensedGameTitle('Florida vs. FAU | Condensed Game'), true);
    assert.equal(isOfficialHighlightTitle('Florida vs. FAU | Condensed Game'), false);
    assert.equal(isOfficialHighlightTitle('Florida vs Campbell Condensed Game'), false);
  });
});
