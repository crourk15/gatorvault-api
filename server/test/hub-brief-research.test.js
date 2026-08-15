/**
 * Hub Copy Brief must research visitor/Swamp beats (not thin tweet dump).
 * Run: node --test server/test/hub-brief-research.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractNamelessCues,
  researchHubBeatRows,
  recruitSignalInText
} = require('../lib/hub-brief-research');
const { buildHubDeskBrief } = require('../lib/beat-brief-packet');

const BOARD = [
  {
    slug: 'asher-ghioto',
    name: 'Asher Ghioto',
    stars: 5,
    pos: 'EDGE',
    natlRank: 3,
    posRank: 1,
    classYear: 2028,
    fitScore: 90,
    visits: [{ school: 'Florida' }]
  },
  {
    slug: 'antonio-thomas-jr',
    name: 'Antonio Thomas Jr',
    stars: 4,
    pos: 'EDGE',
    natlRank: 17,
    posRank: 5,
    classYear: 2028,
    visits: [{ school: 'Florida' }]
  },
  {
    slug: 'brysen-wright',
    name: 'Brysen Wright',
    stars: 5,
    pos: 'WR',
    natlRank: 1,
    posRank: 1,
    classYear: 2028,
    visits: [{ school: 'Florida' }]
  },
  {
    slug: 'merrick-ham',
    name: 'Merrick Ham',
    stars: 4,
    pos: 'EDGE',
    classYear: 2028,
    visits: [{ school: 'Florida' }]
  },
  {
    slug: 'tyree-mannings-jr',
    name: 'Tyree Mannings Jr.',
    stars: 4,
    pos: 'WR',
    classYear: 2028,
    visits: []
  }
];

const VISITOR_ROWS = [
  {
    detail:
      "NEW: Florida's fall visitor list is loaded — 5-star edge, the No. 1 WR in the country, flip targets",
    source: 'beat',
    reportedAt: '2026-08-14T20:24:59.000Z'
  },
  {
    detail: 'Four-star 2028 WR Tyree Mannings Jr. announced his Top 8 and his visit schedule',
    source: 'beat'
  },
  {
    detail: 'Four-star 2028 EDGE Merrick Ham will return to the Swamp on Sept. 26',
    source: 'beat'
  }
];

describe('hub-brief-research', () => {
  it('detects recruit signals on visitor-list copy', () => {
    assert.equal(recruitSignalInText(VISITOR_ROWS[0].detail), true);
    assert.equal(recruitSignalInText('Fall camp is almost here for the Gators.'), false);
  });

  it('parses nameless 5-star EDGE + No. 1 WR cues', () => {
    const cues = extractNamelessCues(VISITOR_ROWS[0].detail);
    assert.ok(cues.some((c) => c.stars === 5 && c.pos === 'EDGE'));
    assert.ok(cues.some((c) => c.no1 && c.pos === 'WR'));
  });

  it('resolves 5-star edge → Ghioto (not 4-star Thomas) and No. 1 → Wright', async () => {
    const out = await researchHubBeatRows(VISITOR_ROWS, {
      players: BOARD,
      skipNetwork: true
    });
    assert.equal(out.ran, true);
    const edge = out.cueResolves.find((c) => /5-star edge/i.test(c.cue));
    const no1 = out.cueResolves.find((c) => /no\.?\s*1/i.test(c.cue));
    assert.equal(edge?.playerSlug, 'asher-ghioto');
    assert.equal(no1?.playerSlug, 'brysen-wright');
    assert.ok(out.named.some((n) => n.playerSlug === 'merrick-ham'));
    assert.ok(out.named.some((n) => /mannings/i.test(n.playerName)));
    assert.match(out.pasteBlock, /Asher Ghioto/);
    assert.match(out.pasteBlock, /Brysen Wright/);
  });

  it('skips research when hub beat has no recruit signal', async () => {
    const out = await researchHubBeatRows(
      [{ detail: 'Fall camp is almost here. First practice sets the tone.' }],
      { players: BOARD, skipNetwork: true }
    );
    assert.equal(out.ran, false);
    assert.equal(out.pasteBlock, null);
  });
});

describe('buildHubDeskBrief research', () => {
  it('embeds RESEARCH names into stadium hub paste', async () => {
    const brief = await buildHubDeskBrief('uf-program-stadium-facility', {
      beatRows: VISITOR_ROWS,
      players: BOARD,
      skipNetwork: true
    });
    assert.equal(brief.ok, true);
    assert.equal(brief.hubTopic, true);
    assert.equal(brief.research?.ran, true);
    assert.match(brief.pasteText, /RESEARCH \(hub/);
    assert.match(brief.pasteText, /Asher Ghioto/);
    assert.match(brief.pasteText, /Brysen Wright/);
    assert.match(brief.pasteText, /RESEARCH RULE/);
    assert.doesNotMatch(brief.pasteText, /thin_board/);
    assert.match(String(brief.boardFacts), /Ghioto|Cue resolves/i);
  });

  it('keeps thin camp brief when no recruit cues', async () => {
    const brief = await buildHubDeskBrief('uf-team-camp', {
      beatRows: [{ detail: 'Fall camp is almost here for the Gators.' }],
      players: BOARD,
      skipNetwork: true
    });
    assert.equal(brief.ok, true);
    assert.equal(brief.research?.ran, false);
    assert.doesNotMatch(brief.pasteText, /RESEARCH \(hub/);
  });
});
