/**
 * Board Intel must surface verified unofficial visits + honest timestamps.
 * Run: node --test server/test/board-intel-uv-activity.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isVerifiedVisitLogSource,
  getVerifiedFloridaVisitWindow,
  getVerifiedFloridaVisitActivity,
  buildVerifiedVisitActivityRows,
  buildVerifiedVisitRecapRows,
  isBoardIntelVisitFresh,
  BOARD_INTEL_VISIT_MAX_AGE_DAYS,
} = require('../lib/visit-intel-utils');
const { buildFutureCastIntelAlertsSync } = require('../lib/futurecast-intel-alerts');

describe('Board Intel visit activity', () => {
  it('treats beat logs with playerSlug as verified', () => {
    assert.equal(
      isVerifiedVisitLogSource('beat:alderman', { playerSlug: 'derrell-hines-jr' }),
      true
    );
  });

  it('keeps OV window OV-only but activity includes UV', () => {
    const uv = {
      playerSlug: 'derrell-hines-jr',
      playerName: 'Derrell Hines Jr.',
      source: 'on3',
      visitType: 'uv',
      school: 'Florida',
      date: '2026-06-20',
      reportedAt: '2026-08-13T13:42:15.993Z',
    };
    assert.equal(getVerifiedFloridaVisitWindow(uv), null);
    const act = getVerifiedFloridaVisitActivity(uv);
    assert.equal(act.kind, 'unofficial');
    assert.equal(act.visitStart, '2026-06-20');
    assert.equal(act.reportedAt, '2026-08-13T13:42:15.993Z');
  });

  it('drops stale June UVs even when reportedAt is recent', () => {
    const asOf = new Date('2026-08-16T12:00:00Z');
    assert.equal(isBoardIntelVisitFresh('2026-06-20', '2026-06-20', asOf), false);
    assert.ok(BOARD_INTEL_VISIT_MAX_AGE_DAYS <= 30);

    const logs = [
      {
        playerSlug: 'derrell-hines-jr',
        playerName: 'Derrell Hines Jr.',
        source: 'on3',
        visitType: 'unofficial_visit',
        school: 'Florida',
        date: '2026-06-20',
        reportedAt: '2026-08-13T13:42:15.993Z',
      },
      {
        playerSlug: 'fresh-uv-kid',
        playerName: 'Fresh UV Kid',
        source: 'on3',
        visitType: 'unofficial_visit',
        school: 'Florida',
        date: '2026-08-05',
        reportedAt: '2026-08-15T00:00:00.000Z',
      },
    ];
    const rows = buildVerifiedVisitActivityRows([], logs, asOf, {
      limit: 8,
      prioritySlugs: ['derrell-hines-jr', 'fresh-uv-kid'],
      kinds: ['unofficial'],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'fresh-uv-kid');
  });

  it('drops stale completed OVs from recap', () => {
    const asOf = new Date('2026-08-16T12:00:00Z');
    const logs = [
      {
        playerSlug: 'old-ov',
        playerName: 'Old OV',
        source: 'on3',
        visitType: 'official_visit',
        school: 'Florida',
        date: '2026-06-11',
        reportedAt: '2026-06-24T00:00:00.000Z',
      },
      {
        playerSlug: 'fresh-ov',
        playerName: 'Fresh OV',
        source: 'on3',
        visitType: 'official_visit',
        school: 'Florida',
        date: '2026-08-01',
        reportedAt: '2026-08-04T00:00:00.000Z',
      },
    ];
    const rows = buildVerifiedVisitRecapRows([], logs, asOf, {
      limit: 8,
      prioritySlugs: ['old-ov', 'fresh-ov'],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'fresh-ov');
  });

  it('sync Board Intel keeps upcoming OV timestamps honest', () => {
    const alerts = buildFutureCastIntelAlertsSync({ asOf: new Date('2026-08-16T12:00:00Z') });
    assert.ok(Array.isArray(alerts));
    const staleUv = alerts.find(
      (a) => a.type === 'visit_uv' && /2026-06-20/.test(String(a.message || ''))
    );
    assert.equal(staleUv, undefined, 'June UV must not appear on Aug 16 Board Intel');
    const upcoming = alerts.find((a) => a.type === 'visit_upcoming' && a.playerSlug === 'brysen-wright');
    if (upcoming) {
      const t = Date.parse(upcoming.createdAt);
      assert.ok(
        t <= Date.parse('2026-08-16T12:00:00Z') + 60_000,
        'upcoming createdAt must not be future visit start'
      );
    }
  });
});
