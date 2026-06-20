const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadHubDataset,
  enrichHubPlayer,
  buildBattleContext,
  buildHeatIndexRows,
  buildBattleBoardRows,
  buildBattlesListRows,
  buildMovementFeedItems,
} = require('../../lib/recruiting-hub-data');
const { buildHubBattles } = require('../../lib/recruiting-hub-elite');
const { loadHubRecruitingPool } = require('../../lib/recruiting-hub-intel-store');

describe('Phase 3 unified hub data', () => {
  it('loadHubDataset returns enriched players with ufScore and competitors', async () => {
    const dataset = await loadHubDataset({ classYears: [2027] });
    assert.ok(dataset.players instanceof Map);
    assert.ok(dataset.players.size > 0);
    assert.ok(Array.isArray(dataset.intelRows));
    assert.ok(dataset.loadedAt);

    const sample = [...dataset.players.values()].find((p) => p.ufScore != null) ||
      [...dataset.players.values()][0];
    assert.ok(sample.slug);
    assert.ok(Array.isArray(sample.competitors));
    assert.ok('battleDifficulty' in sample);
    assert.ok(sample.geo);
  });

  it('buildBattleContext never returns competitorName Field', async () => {
    const dataset = await loadHubDataset({ classYears: [2027, 2028, 2029] });
    for (const player of dataset.players.values()) {
      const ctx = buildBattleContext(player);
      assert.notEqual(ctx.competitorName, 'Field');
    }

    const synthetic = buildBattleContext(
      enrichHubPlayer(
        {
          slug: 'synthetic-test',
          name: 'Synthetic Test',
          ufProbability: 55,
          leaderSchool: 'Florida',
        },
        { intelRows: [], visitLogs: [], offerLogs: [] }
      )
    );
    assert.notEqual(synthetic.competitorName, 'Field');
    assert.equal(synthetic.uf, 55);
  });

  it('Heat Index and Battle Board share ufScore and top competitor for same slug', async () => {
    const dataset = await loadHubDataset({ classYears: [2027] });
    const targets = [...dataset.players.values()].filter((p) => !p.isCommit);
    const heatRows = buildHeatIndexRows(targets);
    const boardRows = buildBattleBoardRows(targets);

    const heatById = new Map(heatRows.map((r) => [r.id, r]));
    for (const board of boardRows) {
      const heat = heatById.get(board.id);
      if (!heat) continue;
      assert.equal(heat.ufPercent, board.ufScore, `ufScore mismatch for ${board.id}`);
      const topBoard = [...(board.competitors || [])]
        .filter((c) => c.score != null)
        .sort((a, b) => b.score - a.score)[0];
      if (topBoard && heat.battle.competitor != null) {
        assert.equal(heat.battle.competitor, topBoard.score);
        assert.equal(heat.battle.competitorName, topBoard.school);
      }
    }
  });

  it('buildHubBattles does not pad with heat-check fake rows', async () => {
    const battles = await buildHubBattles(2027);
    for (const row of battles) {
      assert.notEqual(row.ufPercent, '—');
      assert.match(row.ufPercent, /^\d+%$/);
    }
  });

  it('buildBattlesListRows never emits ufPercent dash padding', () => {
    const rows = buildBattlesListRows([
      enrichHubPlayer(
        { slug: 'low-uf', name: 'Low UF', classYear: 2027, ufProbability: 10 },
        { intelRows: [], visitLogs: [], offerLogs: [] }
      ),
      enrichHubPlayer(
        { slug: 'battle-target', name: 'Battle Target', classYear: 2027, ufProbability: 48 },
        { intelRows: [], visitLogs: [], offerLogs: [] }
      ),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ufPercent, '48%');
  });
});

describe('movement feed visit logs', () => {
  let tmpDir;
  let prevTestDir;
  let visitLogStoreFresh;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-hub-phase3-'));
    prevTestDir = process.env.RECRUITING_TEST_DATA_DIR;
    process.env.RECRUITING_TEST_DATA_DIR = tmpDir;
    fs.writeFileSync(
      path.join(tmpDir, 'visit_logs.json'),
      JSON.stringify({ version: 1, updatedAt: null, items: [] }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, 'offer_logs.json'),
      JSON.stringify({ version: 1, updatedAt: null, items: [] }, null, 2)
    );
    delete require.cache[require.resolve('../../lib/recruiting-visit-log-store')];
    delete require.cache[require.resolve('../../lib/recruiting-offer-log-store')];
    delete require.cache[require.resolve('../../lib/recruiting-hub-data')];
    visitLogStoreFresh = require('../../lib/recruiting-visit-log-store');
  });

  after(() => {
    if (prevTestDir == null) delete process.env.RECRUITING_TEST_DATA_DIR;
    else process.env.RECRUITING_TEST_DATA_DIR = prevTestDir;
    delete require.cache[require.resolve('../../lib/recruiting-visit-log-store')];
    delete require.cache[require.resolve('../../lib/recruiting-offer-log-store')];
    delete require.cache[require.resolve('../../lib/recruiting-hub-data')];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('includes visit log events when logs exist for pool players', async () => {
    const pool = await loadHubRecruitingPool();
    const slug = [...pool.keys()][0];
    assert.ok(slug, 'pool should have at least one target');

    visitLogStoreFresh.appendVisitLog({
      playerSlug: slug,
      playerName: pool.get(slug).name,
      school: 'Florida',
      visitType: 'official_visit',
      reportedAt: new Date().toISOString(),
    });

    const hubData = require('../../lib/recruiting-hub-data');
    const dataset = await hubData.loadHubDataset({ classYears: [2027, 2028, 2029] });
    const feed = await hubData.buildMovementFeedItems([...dataset.players.values()], dataset.intelRows, {
      visitLogs: visitLogStoreFresh.listVisitLogs({ limit: 200 }),
      offerLogs: [],
    });

    const visitItems = feed.filter((item) => String(item.id).startsWith('visit-log-'));
    assert.ok(visitItems.length >= 1, 'expected at least one visit-log feed item');
    assert.match(visitItems[0].summary, /official visit/i);
  });
});
