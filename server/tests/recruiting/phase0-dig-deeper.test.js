const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isCuratedHubIntel,
  VERIFIED_SOURCES,
  BLOCKED_SOURCE,
} = require('../../lib/recruiting-hub-intel-store');
const { resolveStrictUfScore } = require('../../lib/recruiting-hub-competitors');
const {
  extractCompetitorsFromText,
  enrichIntelCompetitors,
} = require('../../lib/recruiting-competitor-extract');

function mockPool(slug = 'test-player') {
  return new Map([
    [
      slug,
      {
        slug,
        name: 'Test Player',
        classYear: 2027,
        isCommit: false,
        isPortal: false,
        profileUrl: `/vault/recruiting/player/${slug}`,
      },
    ],
  ]);
}

function baseIntelRow(overrides = {}) {
  return {
    playerSlug: 'test-player',
    playerName: 'Test Player',
    classYear: 2027,
    source: 'auto:beat-writer',
    eventType: 'official_visit',
    detail: 'Test Player set for official visit to Florida this weekend',
    ufRelevant: true,
    reportedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('hub intel allowlist', () => {
  it('includes auto:beat-writer in verified sources', () => {
    assert.ok(VERIFIED_SOURCES.has('auto:beat-writer'));
  });

  it('allows GM2-passed beat-writer intel in movement feed curation', () => {
    const pool = mockPool();
    const row = baseIntelRow();
    assert.equal(isCuratedHubIntel(row, pool), true);
  });

  it('does not double-block auto:beat-writer via BLOCKED_SOURCE', () => {
    assert.equal(BLOCKED_SOURCE.test('auto:beat-writer'), false);
  });

  it('still blocks raw beat_writer and generic auto:beat sources', () => {
    assert.equal(BLOCKED_SOURCE.test('beat_writer'), true);
    assert.equal(BLOCKED_SOURCE.test('auto:beat'), true);
    assert.equal(BLOCKED_SOURCE.test('twitter'), true);
    assert.equal(BLOCKED_SOURCE.test('x_post'), true);
    assert.equal(BLOCKED_SOURCE.test('auto:x-autoposter'), true);
    assert.equal(BLOCKED_SOURCE.test('podcast'), true);
  });

  it('rejects unverified beat-writer variants not on the allowlist', () => {
    const pool = mockPool();
    const row = baseIntelRow({ source: 'beat_writer' });
    assert.equal(isCuratedHubIntel(row, pool), false);
  });
});

describe('rivals ufProbability mapping', () => {
  it('resolveStrictUfScore reads ufProbability set from rivals confidence', () => {
    const player = {
      slug: 'rivals-target',
      ufProbability: 72,
      rivalsConfidence: 72,
    };
    assert.equal(resolveStrictUfScore(player, []), 72);
  });

  it('maps rivals PM confidence shape used at ingest time', () => {
    const confidence = 68;
    const existing = { ufProbability: null };
    const patch = {
      rivalsConfidence: confidence,
      ufProbability: confidence != null ? Number(confidence) : existing?.ufProbability ?? null,
    };
    assert.equal(patch.ufProbability, 68);
    assert.equal(resolveStrictUfScore({ slug: 'x', ...patch }, []), 68);
  });
});

describe('competitor extraction', () => {
  it('extracts a single competitor from battle language', () => {
    const out = extractCompetitorsFromText(
      'Florida is in a recruiting battle with Georgia for this 2027 WR'
    );
    assert.equal(out.competitorSchool, 'Georgia');
    assert.deepEqual(out.competitorMentions, ['Georgia']);
  });

  it('extracts multiple competitors in priority order', () => {
    const out = extractCompetitorsFromText(
      'OV to Florida cancelled — now visiting Alabama and also hearing from LSU'
    );
    assert.ok(out.competitorMentions.includes('Alabama'));
    assert.ok(out.competitorMentions.includes('LSU'));
    assert.equal(out.competitorSchool, 'Alabama');
  });

  it('recognizes FSU alias', () => {
    const out = extractCompetitorsFromText('Insiders say FSU is pulling ahead in this battle');
    assert.equal(out.competitorSchool, 'Florida State');
  });

  it('enrichIntelCompetitors merges onto intel row without overwriting existing fields', () => {
    const enriched = enrichIntelCompetitors({
      detail: 'Player also took a visit to Miami',
      competitorSchool: 'Clemson',
      competitorMentions: ['Clemson'],
    });
    assert.equal(enriched.competitorSchool, 'Clemson');
    assert.ok(enriched.competitorMentions.includes('Clemson'));
    assert.ok(enriched.competitorMentions.includes('Miami'));
  });

  it('uses nextVisitSchool text when detail is sparse', () => {
    const enriched = enrichIntelCompetitors({
      detail: 'OV cancelled for Florida target',
      nextVisitSchool: 'Ohio State',
    });
    assert.equal(enriched.competitorSchool, 'Ohio State');
    assert.deepEqual(enriched.competitorMentions, ['Ohio State']);
  });
});
