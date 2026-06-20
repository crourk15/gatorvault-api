const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-phase1-'));
process.env.RECRUITING_TEST_DATA_DIR = tempDir;

const visitLogStore = require('../../lib/recruiting-visit-log-store');
const offerLogStore = require('../../lib/recruiting-offer-log-store');
const {
  mergeCompetitorEntry,
  normalizeSchoolKey,
} = require('../../lib/recruiting-competitor-merge');
const { extractRealCompetitors } = require('../../lib/recruiting-hub-competitors');

after(() => {
  delete process.env.RECRUITING_TEST_DATA_DIR;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('visit-log-store append/dedupe', () => {
  it('appends a visit log entry', () => {
    const first = visitLogStore.appendVisitLog({
      playerSlug: 'test-player',
      playerName: 'Test Player',
      school: 'Florida',
      visitType: 'official_visit',
      date: '2026-06-20',
      source: 'auto:beat-writer',
      reportedAt: '2026-06-20T12:00:00.000Z',
    });
    assert.equal(first.created, true);
    assert.equal(first.duplicate, false);
    assert.ok(first.item.fingerprint);
  });

  it('dedupes by fingerprint on repeat append', () => {
    const entry = {
      playerSlug: 'test-player',
      school: 'Florida',
      visitType: 'official_visit',
      date: '2026-06-20',
      source: 'auto:beat-writer',
      reportedAt: '2026-06-20T12:00:00.000Z',
    };
    const second = visitLogStore.appendVisitLog(entry);
    assert.equal(second.created, false);
    assert.equal(second.duplicate, true);
    const listed = visitLogStore.listVisitLogs({ playerSlug: 'test-player' });
    assert.equal(listed.length, 1);
  });
});

describe('offer-log-store append/dedupe', () => {
  it('appends an offer log entry', () => {
    const first = offerLogStore.appendOfferLog({
      playerSlug: 'offer-player',
      school: 'Florida',
      offerType: 'offer',
      date: '2026-06-20',
      source: 'auto:beat-writer',
      reportedAt: '2026-06-20T13:00:00.000Z',
    });
    assert.equal(first.created, true);
    assert.ok(first.item.fingerprint);
  });

  it('dedupes duplicate offer fingerprints', () => {
    const entry = {
      playerSlug: 'offer-player',
      school: 'Florida',
      offerType: 'offer',
      date: '2026-06-20',
      source: 'auto:beat-writer',
      reportedAt: '2026-06-20T13:00:00.000Z',
    };
    const dup = offerLogStore.appendOfferLog(entry);
    assert.equal(dup.duplicate, true);
    const listed = offerLogStore.listOfferLogs({ playerSlug: 'offer-player' });
    assert.equal(listed.length, 1);
  });
});

describe('competitor-merge dedupe', () => {
  it('dedupes by normalized school and prefers newer updatedAt for score/trend', () => {
    const base = [{ school: 'Georgia', score: 40, source: 'on3', updatedAt: '2026-06-01T00:00:00.000Z', trend: 'flat' }];
    const merged = mergeCompetitorEntry(base, {
      school: 'georgia',
      score: 55,
      source: 'rivals_pm',
      updatedAt: '2026-06-15T00:00:00.000Z',
      trend: 'up',
    });
    assert.equal(merged.length, 1);
    assert.equal(normalizeSchoolKey(merged[0].school), 'georgia');
    assert.equal(merged[0].score, 55);
    assert.equal(merged[0].trend, 'up');
    assert.equal(merged[0].source, 'rivals_pm');
  });

  it('keeps existing score when incoming is older', () => {
    const base = [{ school: 'Alabama', score: 60, source: 'on3', updatedAt: '2026-06-20T00:00:00.000Z', trend: 'up' }];
    const merged = mergeCompetitorEntry(base, {
      school: 'Alabama',
      score: 45,
      source: 'beat',
      updatedAt: '2026-06-01T00:00:00.000Z',
      trend: 'down',
    });
    assert.equal(merged[0].score, 60);
    assert.equal(merged[0].trend, 'up');
  });
});

describe('extractRealCompetitors prefers competitors[]', () => {
  it('uses player.competitors as primary and skips intel-only fallback', () => {
    const player = {
      slug: 'battle-target',
      competitors: [{ school: 'Georgia', score: 62, trend: 'up', source: 'on3' }],
    };
    const intelRows = [
      {
        playerSlug: 'battle-target',
        competitorSchool: 'Alabama',
        competitorMentions: ['Alabama', 'LSU'],
        confidencePct: 80,
      },
    ];
    const out = extractRealCompetitors(player, intelRows);
    assert.equal(out.length, 1);
    assert.equal(out[0].school, 'Georgia');
    assert.equal(out[0].score, 62);
    assert.equal(out[0].trend, 'up');
  });

  it('falls back to intel rows when competitors[] is empty', () => {
    const player = { slug: 'intel-only' };
    const intelRows = [
      {
        playerSlug: 'intel-only',
        competitorSchool: 'Clemson',
        competitorScore: 48,
      },
    ];
    const out = extractRealCompetitors(player, intelRows);
    assert.equal(out[0].school, 'Clemson');
    assert.equal(out[0].score, 48);
  });
});
