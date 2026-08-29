const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('depth-chart-board', () => {
  it('loads bundled fall-camp board with open battles', () => {
    const board = require('../../lib/depth-chart-board');
    const doc = board.getDepthChartBoard();
    assert.equal(doc.mode, 'fall-camp');
    assert.match(doc.label, /Week 1|camp/i);
    assert.ok(doc.offense.length >= 10);
    assert.ok(doc.defense.length >= 10);
    const qb = doc.offense.find((r) => r.pos === 'QB');
    assert.equal(qb.s, 'Aaron Philo');
    assert.equal(qb.third, 'Will Griffin (Fr.)');
    assert.equal(qb.status, 'locked');
    const payload = board.toApiPayload(doc);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.byPhase.off, doc.offense);
  });

  it('writes durable override when GV_DEPTH_CHART_PATH set', () => {
    const board = require('../../lib/depth-chart-board');
    const tmp = path.join(os.tmpdir(), `gv-depth-${Date.now()}.json`);
    const prev = process.env.GV_DEPTH_CHART_PATH;
    process.env.GV_DEPTH_CHART_PATH = tmp;
    try {
      const base = board.getDepthChartBoard();
      const saved = board.saveDepthChartBoard({
        ...base,
        label: 'Test camp board',
        offense: base.offense.map((r) =>
          r.pos === 'QB' ? { ...r, analysis: 'Test QB note for Durkin depth.' } : r
        ),
      });
      assert.equal(saved.label, 'Test camp board');
      assert.ok(fs.existsSync(tmp));
      const again = board.getDepthChartBoard();
      assert.equal(again.label, 'Test camp board');
      assert.match(again.offense.find((r) => r.pos === 'QB').analysis, /Durkin/);
    } finally {
      if (prev == null) delete process.env.GV_DEPTH_CHART_PATH;
      else process.env.GV_DEPTH_CHART_PATH = prev;
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  });

  it('heals stale durable from newer git bundle by updatedAt', () => {
    const board = require('../../lib/depth-chart-board');
    const tmp = path.join(os.tmpdir(), `gv-depth-stale-${Date.now()}.json`);
    const prev = process.env.GV_DEPTH_CHART_PATH;
    process.env.GV_DEPTH_CHART_PATH = tmp;
    try {
      const base = board.getDepthChartBoard();
      const stale = {
        ...base,
        updatedAt: '2020-01-01T00:00:00.000Z',
        offense: base.offense.map((r) =>
          r.pos === 'QB' ? { ...r, third: 'Aidan Warner (R-Jr.)' } : r
        ),
      };
      fs.writeFileSync(tmp, JSON.stringify(stale, null, 2));
      const healed = board.getDepthChartBoard();
      assert.equal(healed.offense.find((r) => r.pos === 'QB').third, 'Will Griffin (Fr.)');
      assert.ok(parseTs(healed.updatedAt) > parseTs('2020-01-01T00:00:00.000Z'));
    } finally {
      if (prev == null) delete process.env.GV_DEPTH_CHART_PATH;
      else process.env.GV_DEPTH_CHART_PATH = prev;
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  });
});

function parseTs(iso) {
  const ms = Date.parse(String(iso || ''));
  return Number.isFinite(ms) ? ms : 0;
}
