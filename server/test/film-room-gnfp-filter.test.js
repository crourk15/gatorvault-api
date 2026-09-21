/**
 * Film Breakdown should keep GNFP tape reviews and drop coach podcast sit-downs.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isGnfpFilmBreakdownTitle,
  isFilmGuyFloridaBreakdownTitle,
  isTengwallUfFilmReview,
  isOfficialHighlightTitle,
  isCondensedGameTitle,
  shouldKeepEntry,
  mergeBucket,
  DEFAULT_SOURCES,
  titleHasUfFootball,
} = require('../lib/film-room-youtube-ingest');
const { loadLegacyVideoCatalog } = require('../lib/film-room-legacy');

const GNFP_SOURCE = { kind: 'gnfp', bucket: 'gnfp', label: 'GNFP' };
const FILM_GUY_SOURCE = { kind: 'film_guy', bucket: 'filmGuy', label: 'Film Guy Network' };
const TENGWALL_SOURCE = { kind: 'tengwall', bucket: 'tengwall', label: 'Landon Tengwall' };

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
      isFilmGuyFloridaBreakdownTitle(
        'FILM STUDY: How Alabama QB Keelon Russell TORCHED Florida State\'s Defense'
      ),
      false
    );
    assert.equal(titleHasUfFootball('FILM STUDY: How Florida\'s Run Game DOMINATED Auburn\'s Defense'), true);
    assert.equal(titleHasUfFootball('FILM STUDY: Why Alabama’s Pass Rush is TERRIFYING | Alabama vs Florida State Preview'), false);
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

describe('Tengwall UF 2026 run-game film only', () => {
  it('watches the Tengwall channel on default ingest', () => {
    assert.ok(
      DEFAULT_SOURCES.some(
        (s) => s.channelId === 'UCKhl02UZMecnCNweA2nMnQw' && s.bucket === 'tengwall'
      )
    );
  });

  it('keeps the Auburn UF run study and later UF run tapes', () => {
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: How Florida\'s Run Game DOMINATED Auburn\'s Defense',
        youtubeId: 'MRjoBzMLD2s',
        publishedAt: '2026-09-20T23:13:48.000Z',
      }),
      true
    );
    assert.equal(
      shouldKeepEntry(
        {
          title: 'FILM STUDY: How Florida\'s Run Game DOMINATED Auburn\'s Defense',
          youtubeId: 'MRjoBzMLD2s',
          publishedAt: '2026-09-20T23:13:48.000Z',
        },
        TENGWALL_SOURCE
      ),
      true
    );
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: How Florida\'s Run Game Beat Ole Miss',
        youtubeId: 'laterUfRunxx',
        publishedAt: '2026-09-28T18:00:00.000Z',
      }),
      true
    );
  });

  it('drops pass-game sits, other teams, FSU, and the Week 1 FAU tape', () => {
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: How Florida\'s Pass Game Beat Auburn',
        youtubeId: 'passGamexxxx',
        publishedAt: '2026-09-21T12:00:00.000Z',
      }),
      false
    );
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: How Florida\'s Run Game DOMINATED FAU',
        youtubeId: 'UXOweKkBadI',
        publishedAt: '2026-09-07T16:34:00.000Z',
      }),
      false
    );
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: How Alabama QB Keelon Russell TORCHED Florida State\'s Defense',
        youtubeId: 'x-M-T3SPWeY',
        publishedAt: '2026-09-20T19:11:26.000Z',
      }),
      false
    );
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: Why Kamario Taylor Is The Most Talented QB In CFB | Mississippi St vs South Carolina',
        youtubeId: 'SAMAVq1EJgQ',
        publishedAt: '2026-09-20T21:17:00.000Z',
      }),
      false
    );
    assert.equal(
      isTengwallUfFilmReview({
        title: 'FILM STUDY: How Good Is Florida’s New Left Tackle Bryce Lovett?',
        youtubeId: 'dZIK_bv55N4',
        publishedAt: '2026-08-15T16:00:00.000Z',
      }),
      false
    );
    assert.equal(
      shouldKeepEntry(
        {
          title: 'FILM STUDY: How Florida\'s Run Game DOMINATED FAU',
          youtubeId: 'UXOweKkBadI',
          publishedAt: '2026-09-07T16:34:00.000Z',
        },
        TENGWALL_SOURCE
      ),
      false
    );
  });

  it('prunes non-UF Tengwall rows from the merge bucket', () => {
    const existing = [
      {
        id: 'yt_fau',
        title: 'FILM STUDY: How Florida\'s Run Game DOMINATED FAU',
        youtubeId: 'UXOweKkBadI',
        publishedAt: '2026-09-07T16:34:00.000Z',
      },
      {
        id: 'yt_auburn',
        title: 'FILM STUDY: How Florida\'s Run Game DOMINATED Auburn\'s Defense',
        youtubeId: 'MRjoBzMLD2s',
        publishedAt: '2026-09-20T23:13:48.000Z',
      },
    ];
    const { rows } = mergeBucket(existing, [], { pruneTengwallNonUf: true });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'yt_auburn');
  });

  it('includes the Auburn Tengwall study on Film Breakdowns', () => {
    const items = loadLegacyVideoCatalog();
    const row = items.find((i) => i.youtubeId === 'MRjoBzMLD2s');
    assert.ok(row, 'MRjoBzMLD2s missing from Film Room catalog');
    assert.match(String(row.source || ''), /Tengwall/i);
    assert.match(String(row.title || ''), /Auburn/i);
    assert.ok(!items.some((i) => i.youtubeId === 'UXOweKkBadI'));
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
