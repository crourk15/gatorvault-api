'use strict';
/**
 * Film Room pressers: same-day speaker re-uploads must not double the hub rail.
 * Run: node --test server/test/film-room-presser-dedupe.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  dedupePressersByEvent,
  normalizePresserSpeaker,
  presserEventKey,
} = require('../lib/film-room-youtube-ingest');

describe('Film Room presser same-event dedupe', () => {
  it('extracts Sumrall last name from formal, short, and HC Jon titles', () => {
    assert.equal(
      normalizePresserSpeaker('Florida Football Press Conference | Coach Sumrall'),
      'sumrall'
    );
    assert.equal(normalizePresserSpeaker('Coach Sumrall Press Conference 8-4-26'), 'sumrall');
    assert.equal(
      normalizePresserSpeaker('Florida HC Jon Sumrall Press Conference | SEC Media Days 2026'),
      'sumrall'
    );
    assert.equal(
      normalizePresserSpeaker('Florida HC Jon Sumrall - SEC Media Days 2026 Press Conference'),
      'sumrall'
    );
  });

  it('keeps one Aug 4 Sumrall when two YouTube IDs exist', () => {
    const rows = [
      {
        id: 'yt_SDwvq_lIsys',
        youtubeId: 'SDwvq_lIsys',
        title: 'Florida Football Press Conference | Coach Sumrall',
        source: 'Florida Gators Football',
        publishedAt: '2026-08-04T22:13:58Z',
      },
      {
        id: 'yt_UEzcnP7UAfo',
        youtubeId: 'UEzcnP7UAfo',
        title: 'Coach Sumrall Press Conference 8-4-26',
        source: 'Florida Gators Football',
        publishedAt: '2026-08-04T18:15:15Z',
      },
    ];
    assert.equal(presserEventKey(rows[0]), presserEventKey(rows[1]));
    const out = dedupePressersByEvent(rows);
    assert.equal(out.length, 1);
    assert.equal(out[0].youtubeId, 'SDwvq_lIsys');
  });

  it('keeps distinct SEC Media Days speakers on the same day', () => {
    const rows = [
      {
        id: 'a',
        title: 'Florida Football Press Conference | SEC Media Days — Jadan Baugh',
        source: 'Florida Gators Football',
        publishedAt: '2026-07-22T15:20:00.000Z',
      },
      {
        id: 'b',
        title: 'Florida Football Press Conference | SEC Media Days — Myles Graham',
        source: 'Florida Gators Football',
        publishedAt: '2026-07-22T15:15:00.000Z',
      },
      {
        id: 'c',
        title: 'Florida Football Press Conference | SEC Media Days — Vernell Brown III',
        source: 'Florida Gators Football',
        publishedAt: '2026-07-22T15:10:00.000Z',
      },
    ];
    const out = dedupePressersByEvent(rows);
    assert.equal(out.length, 3);
    assert.equal(normalizePresserSpeaker(rows[2].title), 'brown');
  });

  it('collapses Jul 22 Sumrall official + HC Jon mirror to one row', () => {
    const out = dedupePressersByEvent([
      {
        id: 'official',
        title: 'SEC Media Day Press Conference | Coach Sumrall',
        source: 'Florida Gators Football',
        publishedAt: '2026-07-22T23:29:49.000Z',
      },
      {
        id: 'mirror',
        title: 'Florida HC Jon Sumrall Press Conference | SEC Media Days 2026',
        source: 'SEC Media Days / FOX54',
        publishedAt: '2026-07-22T15:30:00.000Z',
      },
      {
        id: 'baugh',
        title: 'Florida Football Press Conference | SEC Media Days — Jadan Baugh',
        source: 'SEC Media Days',
        publishedAt: '2026-07-22T15:20:00.000Z',
      },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out.find((r) => r.id === 'official')?.id, 'official');
    assert.equal(out.find((r) => r.id === 'baugh')?.id, 'baugh');
    assert.equal(out.some((r) => r.id === 'mirror'), false);
  });

  it('collapses live Aug 10 + Aug 17 Sumrall formal/short pairs', () => {
    const out = dedupePressersByEvent([
      {
        id: 'f17',
        title: 'Florida Football Press Conference | Coach Sumrall',
        source: 'Florida Gators Football',
        publishedAt: '2026-08-17T20:00:00.000Z',
      },
      {
        id: 's17',
        title: 'Coach Sumrall Press Conference 8-17-26',
        source: 'Florida Gators Football',
        publishedAt: '2026-08-17T18:00:00.000Z',
      },
      {
        id: 'f10',
        title: 'Florida Football Press Conference | Coach Sumrall',
        source: 'Florida Gators Football',
        publishedAt: '2026-08-10T20:00:00.000Z',
      },
      {
        id: 's10',
        title: 'Coach Sumrall Press Conference 8-10-26',
        source: 'Florida Gators Football',
        publishedAt: '2026-08-10T18:00:00.000Z',
      },
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((r) => r.id).sort(),
      ['f10', 'f17']
    );
  });

  it('prefers official channel over search mirror', () => {
    const out = dedupePressersByEvent([
      {
        id: 'search',
        title: 'Florida HC Jon Sumrall - SEC Media Days 2026 Press Conference',
        source: 'Rocky Top Insider',
        publishedAt: null,
      },
      {
        id: 'official',
        title: 'SEC Media Day Press Conference | Coach Sumrall',
        source: 'Florida Gators Football',
        publishedAt: '2026-07-14T18:00:00.000Z',
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'official');
  });
});
