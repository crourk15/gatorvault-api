const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWeekendRecapRows,
  buildRecapPostText,
  runVisitIntelRecap,
  isoWeekKey,
} = require('../lib/visit-intel-recap');
const {
  isFloridaOfficialVisit,
  isUpcomingVisit,
  handleNewVerifiedVisitLogs,
  shouldSkipUfCommitVisitAlert,
} = require('../lib/visit-intel-ingest-hooks');

describe('visit-intel-recap', () => {
  it('buildWeekendRecapRows returns recap shape', () => {
    const built = buildWeekendRecapRows('2026-06-22');
    assert.ok(built.weekKey);
    assert.ok(Array.isArray(built.recapRows));
    assert.ok(built.boardSnapshot);
  });

  it('buildRecapPostText includes verified recap language', () => {
    const text = buildRecapPostText([
      { name: 'Test Player', visitStart: '2026-06-11', visitEnd: '2026-06-13' },
    ]);
    assert.match(text, /Verified 2027 summer OV recap/);
    assert.match(text, /futurecast#visits/);
  });

  it('runVisitIntelRecap dryRun does not throw', async () => {
    const result = await runVisitIntelRecap({ dryRun: true, queueX: false, asOf: '2026-06-22' });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
  });

  it('isoWeekKey is stable format', () => {
    assert.match(isoWeekKey(new Date('2026-06-22')), /^\d{4}-W\d{2}$/);
  });
});

describe('visit-intel-ingest-hooks', () => {
  it('isFloridaOfficialVisit accepts on3 official florida log', () => {
    assert.equal(
      isFloridaOfficialVisit({
        playerSlug: 'test-player',
        school: 'Florida',
        visitType: 'official_visit',
        source: 'on3',
        date: '2026-07-01',
      }),
      true
    );
  });

  it('isFloridaOfficialVisit rejects unofficial / uv (includes("official") trap)', () => {
    assert.equal(
      isFloridaOfficialVisit({
        playerSlug: 'test-player',
        school: 'Florida',
        visitType: 'unofficial_visit',
        source: 'on3',
        date: '2099-07-01',
      }),
      false
    );
    assert.equal(
      isFloridaOfficialVisit({
        playerSlug: 'test-player',
        school: 'Florida',
        visitType: 'uv',
        source: 'manual',
        date: '2099-07-01',
      }),
      false
    );
  });

  it('skips instant OV alerts for players already committed to Florida', async () => {
    assert.equal(
      shouldSkipUfCommitVisitAlert({ playerSlug: 'aaron-mcwilliams', playerName: 'Aaron McWilliams' }),
      true
    );
    assert.equal(
      shouldSkipUfCommitVisitAlert({
        playerSlug: 'easton-royal',
        playerName: 'Easton Royal',
        status: 'committed',
        committedTo: 'Texas',
      }),
      false
    );
    const result = await handleNewVerifiedVisitLogs(
      [
        {
          playerSlug: 'aaron-mcwilliams',
          playerName: 'Aaron McWilliams',
          school: 'Florida',
          visitType: 'official_visit',
          source: 'on3',
          date: '2099-09-05',
          fingerprint: 'visit|aaron-mcwilliams|florida|official_visit|2099-09-05',
        },
      ],
      { dryRun: true, queueX: false, asOf: '2026-09-05' }
    );
    assert.equal(result.results[0].skipped, true);
    assert.equal(result.results[0].reason, 'already_uf_commit');
    assert.equal(result.queued, 0);
  });

  it('handleNewVerifiedVisitLogs dryRun skips queue', async () => {
    const result = await handleNewVerifiedVisitLogs(
      [
        {
          playerSlug: 'test-player',
          playerName: 'Test Player',
          school: 'Florida',
          visitType: 'official_visit',
          source: 'on3',
          date: '2099-07-01',
          fingerprint: 'visit|test|florida|official|2099-07-01',
        },
      ],
      { dryRun: true, queueX: false, asOf: '2026-06-22' }
    );
    assert.equal(result.processed, 1);
    assert.equal(result.queued, 0);
  });
});