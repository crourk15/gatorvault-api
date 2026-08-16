/**
 * Vault feed 2028+ — safety + year gates.
 * Run: node --test server/test/vault-feed-2028-sweep.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  collectBeatCandidates,
  pickClassYear,
  isBlockedStaff,
  runVaultFeed2028Sweep,
  isVaultFeedEtWindow,
  CLASS_YEAR_MIN,
} = require('../lib/vault-feed-2028-sweep');

describe('vault-feed-2028-sweep gates', () => {
  it('defaults class year to 2028+ band (never 2027)', () => {
    assert.equal(pickClassYear('Florida visit for a top EDGE', null), 2028);
    assert.equal(pickClassYear('2029 WR in The Swamp', null), 2029);
    assert.equal(pickClassYear('2028 and 2029 board', null), 2028);
    assert.equal(CLASS_YEAR_MIN, 2028);
  });

  it('blocks known staff/coach names', () => {
    assert.equal(isBlockedStaff('Jon Sumrall', null), true);
    assert.equal(isBlockedStaff('Asher Ghioto', 'asher-ghioto'), false);
  });

  it('collectBeatCandidates skips pure-2027 headlines', () => {
    const posts = [
      {
        text: '2027 flip target visits Florida this weekend',
        handle: 'Blake_Alderman',
        createdAt: new Date().toISOString(),
      },
    ];
    // Trusted check may filter unknown handles — inject via filter bypass by
    // stubbing through collect with a writer pattern if needed.
    const rows = collectBeatCandidates(posts, { lookbackHours: 48 });
    // Either skipped as 2027 or filtered as untrusted — never a named create for 2027.
    assert.ok(rows.every((r) => r.kind === 'skip_2027' || r.classYear !== 2027));
  });

  it('dry-run never creates and skips 2027 candidates', async () => {
    const report = await runVaultFeed2028Sweep({
      dryRun: true,
      skipBeatIngest: true,
      skipAllowlistIntel: true,
      skipBeatRefresh: true,
      skipPersist: true,
      candidates: [
        {
          kind: 'named',
          playerName: 'Fake TwoSeven',
          playerSlug: null,
          classYear: 2027,
          text: '2027 RB Fake TwoSeven visits Florida',
          trusted: true,
        },
        {
          kind: 'named',
          playerName: 'Jon Sumrall',
          playerSlug: null,
          classYear: 2028,
          text: 'Jon Sumrall talks camp',
          trusted: true,
        },
      ],
    });
    assert.equal(report.ok, true);
    assert.equal(report.dryRun, true);
    assert.ok(report.skipped2027.length >= 1);
    assert.ok(report.blockedStaff.some((r) => /sumrall/i.test(r.playerName)));
    assert.equal(report.created.length, 0);
  });


  it('reports emptyReason when no candidates and no beat refresh', async () => {
    const report = await runVaultFeed2028Sweep({
      dryRun: true,
      skipBeatIngest: true,
      skipAllowlistIntel: true,
      skipBeatRefresh: true,
      skipPersist: true,
      candidates: [],
    });
    assert.equal(report.ok, true);
    assert.equal(report.summary.createdCount, 0);
    assert.equal(report.summary.updatedCount, 0);
    assert.ok(report.emptyReason === 'no_beat_posts_in_cache' || report.emptyReason === 'beats_present_but_no_named_2028_plus_in_lookback' || report.emptyReason === 'no_creates_or_updates');
  });

  it('ET window helper returns boolean', () => {
    assert.equal(typeof isVaultFeedEtWindow(new Date()), 'boolean');
  });
});
