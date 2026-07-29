/**
 * On3 video extract + film-traits ingest helpers.
 * Run: node --test server/test/film-traits-on3-ingest.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ensureHttpsUrl,
  extractOn3Videos,
  filmSourcesFromOn3Videos,
} = require('../lib/on3-recruit-videos');
const { mergeSources, needsSourceHydration } = require('../lib/film-traits-ingest');
const { formatFilmTraitsBlock } = require('../lib/beat-brief-packet');

describe('on3-recruit-videos', () => {
  it('normalizes bare hudl URLs', () => {
    assert.equal(
      ensureHttpsUrl('www.hudl.com/embed/video/3/1/abc'),
      'https://www.hudl.com/embed/video/3/1/abc'
    );
  });

  it('extracts videos from On3 pageProps fixture shape', () => {
    const pp = {
      videos: {
        list: [
          {
            key: 72496,
            sourceUrl: 'www.hudl.com/embed/video/3/12707228/6186c4f23df5ff0664e06691',
            title: 'Junior SZN',
            category: { value: 'Highlights' },
            date: 1654373150,
            isFeatured: true,
          },
        ],
      },
    };
    const videos = extractOn3Videos(pp);
    assert.equal(videos.length, 1);
    assert.match(videos[0].url, /^https:\/\/www\.hudl\.com\//);
    assert.equal(videos[0].type, 'hudl');
    const sources = filmSourcesFromOn3Videos(videos);
    assert.equal(sources[0].type, 'hudl');
    assert.ok(sources[0].url);
  });

  it('reads videos from war-room On3 probe when present', () => {
    const fixture = path.join(__dirname, '../data/war-room/on3-probe-singleton-rivals.json');
    if (!fs.existsSync(fixture)) return;
    const pp = JSON.parse(fs.readFileSync(fixture, 'utf8'));
    // fixture may be full pageProps or wrapper
    const props = pp.videos ? pp : pp.props?.pageProps || pp;
    const videos = extractOn3Videos(props);
    assert.ok(videos.length >= 1, 'expected at least one video in probe fixture');
    assert.match(videos[0].url, /hudl/i);
  });
});

describe('film-traits-ingest helpers', () => {
  it('merges sources by URL without wiping review stamps', () => {
    const merged = mergeSources(
      [{ url: 'https://www.hudl.com/a', reviewedAt: '2026-07-01', reviewedBy: 'vault' }],
      [{ url: 'https://www.hudl.com/a', label: 'New label', reviewedBy: 'on3-ingest' },
       { url: 'https://www.hudl.com/b', label: 'B' }]
    );
    assert.equal(merged.length, 2);
    const a = merged.find((s) => s.url.endsWith('/a'));
    assert.equal(a.reviewedBy, 'vault');
    assert.equal(a.reviewedAt, '2026-07-01');
  });

  it('needs hydration when sources empty', () => {
    assert.equal(needsSourceHydration(null), true);
    assert.equal(needsSourceHydration({ sources: [] }), true);
    assert.equal(needsSourceHydration({ sources: [{ url: 'https://x' }] }), false);
  });
});

describe('brief film pending state', () => {
  it('marks traits pending when only sources exist', () => {
    const block = formatFilmTraitsBlock({
      playerName: 'Casey Barner',
      sources: [{ type: 'hudl', url: 'https://www.hudl.com/embed/video/3/1/abc', label: 'Highlights' }],
      traits: [],
    });
    assert.match(block, /traits pending review/i);
    assert.match(block, /hudl/i);
  });
});


describe('vault AI film eval', () => {
  it('synthesizes traits from On3 scout signals without naming writers', () => {
    const { synthesizeTraitsFromScout, stripWriterAttribution } = require('../lib/film-traits-ai-eval');
    const cleaned = stripWriterAttribution('Charles Power says Barner wins in man coverage.');
    assert.doesNotMatch(cleaned, /Charles Power/);
    const out = synthesizeTraitsFromScout({
      playerName: 'Casey Barner',
      position: 'S',
      scout: {
        summaryText:
          'Barner consistently shut down shifty wide receivers in man coverage. He showed excellent polish transitioning out of his backpedal, flipping his hips. Compactly built safety with diving pass breakup ability.',
      },
      sources: [{ label: 'Highlights', url: 'https://www.hudl.com/x' }],
    });
    assert.ok(out.traits.length >= 3);
    assert.match(out.traits.join(' '), /man-coverage|backpedal|compact/i);
    assert.doesNotMatch(out.vaultFilmAngle, /Charles Power|beat writer/i);
  });

  it('has casey-barner AI traits seeded', () => {
    const store = require('../lib/film-traits-store');
    const entry = store.getFilmTraitsBySlug('casey-barner');
    assert.ok(entry);
    assert.ok(entry.sources?.length >= 1);
    assert.ok(entry.traits?.length >= 3);
    assert.ok(entry.evaluatedBy);
  });
});
