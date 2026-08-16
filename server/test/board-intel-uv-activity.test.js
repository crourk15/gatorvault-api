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

  it('builds UV activity rows for priority board slugs', () => {
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
        playerSlug: 'off-board-kid',
        playerName: 'Off Board',
        source: 'on3',
        visitType: 'unofficial_visit',
        school: 'Florida',
        date: '2026-06-21',
        reportedAt: '2026-08-14T00:00:00.000Z',
      },
    ];
    const rows = buildVerifiedVisitActivityRows([], logs, new Date('2026-08-16T12:00:00Z'), {
      limit: 8,
      prioritySlugs: ['derrell-hines-jr'],
      kinds: ['unofficial'],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'derrell-hines-jr');
  });

  it('sync Board Intel includes visit_uv for board targets when logs exist', () => {
    const alerts = buildFutureCastIntelAlertsSync({ asOf: new Date('2026-08-16T12:00:00Z') });
    const uvs = alerts.filter((a) => a.type === 'visit_uv');
    assert.ok(uvs.length >= 1, `expected visit_uv rows, got types=${[...new Set(alerts.map((a) => a.type))]}`);
    const upcoming = alerts.find((a) => a.type === 'visit_upcoming' && a.playerSlug === 'brysen-wright');
    if (upcoming) {
      const t = Date.parse(upcoming.createdAt);
      assert.ok(t <= Date.parse('2026-08-16T12:00:00Z') + 60_000, 'upcoming createdAt must not be future visit start');
    }
  });
});
