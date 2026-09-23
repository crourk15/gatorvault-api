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
  summarizeFeedResult,
  runVaultFeed2028Sweep,
  isVaultFeedEtWindow,
  vaultFeedSlotHour,
  vaultFeedSlotId,
  alreadyFinishedThisSlot,
  isActiveVaultFeedRun,
  acceptVaultFeedSweep,
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
    assert.equal(isBlockedStaff("Jon Sumrall's", null), true);
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

describe('vault-feed 7am / 7pm ET slots', () => {
  it('opens at 7 and 8 ET for the 7am slot, 19 and 20 for 7pm', () => {
    assert.equal(vaultFeedSlotHour(7), 7);
    assert.equal(vaultFeedSlotHour(8), 7);
    assert.equal(vaultFeedSlotHour(19), 19);
    assert.equal(vaultFeedSlotHour(20), 19);
    assert.equal(vaultFeedSlotHour(9), null);
    assert.equal(vaultFeedSlotHour(21), null);
  });

  it('treats 8:05 ET as the same slot as 7:05 so a miss can catch up', () => {
    const am7 = new Date('2026-09-22T11:05:00.000Z'); // 7:05 AM EDT
    const am8 = new Date('2026-09-22T12:05:00.000Z'); // 8:05 AM EDT
    const pm7 = new Date('2026-09-22T23:05:00.000Z'); // 7:05 PM EDT
    const pm8 = new Date('2026-09-23T00:05:00.000Z'); // 8:05 PM EDT
    const pm9 = new Date('2026-09-23T01:05:00.000Z'); // 9:05 PM EDT
    assert.equal(isVaultFeedEtWindow(am7), true);
    assert.equal(isVaultFeedEtWindow(am8), true);
    assert.equal(isVaultFeedEtWindow(pm7), true);
    assert.equal(isVaultFeedEtWindow(pm8), true);
    assert.equal(isVaultFeedEtWindow(pm9), false);
    assert.equal(vaultFeedSlotId(am7), '2026-09-22T07');
    assert.equal(vaultFeedSlotId(am8), '2026-09-22T07');
    assert.equal(vaultFeedSlotId(pm7), '2026-09-22T19');
    assert.equal(vaultFeedSlotId(pm8), '2026-09-22T19');
    assert.equal(vaultFeedSlotId(pm9), null);
  });

  it('EST 7pm / 8pm still map to the evening slot', () => {
    const pm7 = new Date('2026-01-15T00:05:00.000Z'); // 7:05 PM EST Jan 14
    const pm8 = new Date('2026-01-15T01:05:00.000Z'); // 8:05 PM EST Jan 14
    assert.equal(isVaultFeedEtWindow(pm7), true);
    assert.equal(isVaultFeedEtWindow(pm8), true);
    assert.equal(vaultFeedSlotId(pm7), vaultFeedSlotId(pm8));
    assert.match(vaultFeedSlotId(pm7), /T19$/);
  });

  it('alreadyFinishedThisSlot is per 7am or 7pm, not the whole day', () => {
    const am = new Date('2026-09-22T11:05:00.000Z');
    const pm = new Date('2026-09-22T23:05:00.000Z');
    const morningDone = {
      status: 'success',
      slotId: '2026-09-22T07',
      startedAt: '2026-09-22T11:05:16.833Z',
      finishedAt: '2026-09-22T11:37:46.797Z',
    };
    assert.equal(alreadyFinishedThisSlot(morningDone, am), true);
    assert.equal(alreadyFinishedThisSlot(morningDone, pm), false);
  });

  it('isActiveVaultFeedRun dies after 15 minutes without a heartbeat', () => {
    const now = Date.parse('2026-09-22T23:20:00.000Z');
    const live = {
      status: 'running',
      startedAt: '2026-09-22T23:05:00.000Z',
      heartbeatAt: '2026-09-22T23:18:00.000Z',
    };
    const dead = {
      status: 'running',
      startedAt: '2026-09-22T23:05:00.000Z',
      heartbeatAt: '2026-09-22T23:04:00.000Z',
    };
    assert.equal(isActiveVaultFeedRun(live, now), true);
    assert.equal(isActiveVaultFeedRun(dead, now), false);
  });

  it('accept does not start a second pass for the same 7pm slot', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        status: 'success',
        slotId: '2026-09-22T19',
        startedAt: '2026-09-22T23:05:00.000Z',
        finishedAt: '2026-09-22T23:40:00.000Z',
      })}\n`
    );
    try {
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: new Date('2026-09-23T00:05:00.000Z'),
      });
      assert.equal(accepted.alreadyDone, true);
      assert.equal(accepted.started, false);
      assert.equal(accepted.accepted, true);
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('accept starts the 7pm slot after a finished 7am report', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        status: 'warning',
        slotId: '2026-09-22T07',
        startedAt: '2026-09-22T11:05:16.833Z',
        finishedAt: '2026-09-22T11:37:46.797Z',
      })}\n`
    );
    try {
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: new Date('2026-09-22T23:05:00.000Z'),
      });
      assert.equal(accepted.started, true);
      assert.equal(accepted.accepted, true);
      assert.equal(accepted.report.slotId, '2026-09-22T19');
      assert.equal(accepted.report.window, '7pm');
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });
});


describe('summarizeFeedResult proof detail', () => {
  it('explains UF% move from decision delta (no prior field)', () => {
    const s = summarizeFeedResult({
      ok: true,
      promoted: true,
      allowlisted: true,
      decision: { pct: 42, delta: 6, source: 'signal_nudge', nudged: true },
      player: { ufProbability: 42, natlRank: 88 },
      steps: [
        { step: 'hydrate', ok: true },
        { step: 'recruiting_store_upsert', ok: true },
        { step: 'futurecast_prediction_refresh', ok: true },
      ],
    });
    assert.match(s.whatChanged, /UF% 36→42/);
    assert.match(s.whatChanged, /promoted onto chase board/);
    assert.match(s.whatChanged, /On3 hydrate/);
    assert.equal(s.ufPct, 42);
    assert.equal(s.promoted, true);
  });

  it('surfaces feed failures clearly', () => {
    const s = summarizeFeedResult({ ok: false, error: 'staff_not_recruit' });
    assert.match(s.whatChanged, /Feed failed: staff_not_recruit/);
  });
});
