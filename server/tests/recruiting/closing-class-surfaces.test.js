const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Closing Class surface gates', () => {
  it('heat index and battles list only include hunt-list rows', () => {
    const hub = require('../../lib/recruiting-hub-data');
    const players = [
      {
        slug: 'tranard-roberts',
        name: 'Tranard Roberts',
        classYear: 2027,
        isCommit: false,
        ufScore: 74,
        tier: 'HIGH',
        competitors: [{ school: 'Georgia', score: 55 }],
      },
      {
        slug: 'seth-williams',
        name: 'Seth Williams',
        classYear: 2027,
        isCommit: false,
        ufScore: 96,
        tier: 'TOP',
        competitors: [{ school: 'Georgia', score: 40 }],
      },
      {
        slug: 'xay-mincey',
        name: 'Xay Mincey',
        classYear: 2027,
        isCommit: false,
        ufScore: null,
        tier: 'HIGH',
      },
    ];
    const heat = hub.buildHeatIndexRows(players).map((r) => r.id || r.name);
    const battles = hub
      .buildBattlesListRows(players.map((p) => ({ ...p, notes: 'beat note' })))
      .map((r) => r.id || r.name);
    assert.ok(heat.includes('tranard-roberts'));
    assert.ok(!heat.includes('seth-williams'));
    assert.ok(!heat.includes('xay-mincey'));
    assert.ok(battles.includes('tranard-roberts'));
    assert.ok(!battles.includes('seth-williams'));
  });

  it('footprint pins only commits + hunt-list targets', () => {
    const hub = require('../../lib/recruiting-hub-data');
    const players = [
      {
        slug: 'davin-davidson',
        name: 'Davin Davidson',
        classYear: 2027,
        isCommit: true,
        isCommittedToUF: true,
        position: 'QB',
        state: 'FL',
        geo: { hometownState: 'FL', pinLat: 27.7, pinLng: -81.6 },
      },
      {
        slug: 'tranard-roberts',
        name: 'Tranard Roberts',
        classYear: 2027,
        isCommit: false,
        isTarget: true,
        position: 'RB',
        state: 'FL',
        ufScore: 74,
        geo: { hometownState: 'FL', pinLat: 27.7, pinLng: -81.6 },
      },
      {
        slug: 'xay-mincey',
        name: 'Xay Mincey',
        classYear: 2027,
        isCommit: false,
        isTarget: true,
        position: 'ATH',
        state: 'FL',
        geo: { hometownState: 'FL', pinLat: 27.7, pinLng: -81.6 },
      },
    ];
    const fp = hub.buildFootprintPayload(players, [], {});
    const ids = fp.pins.map((p) => p.id);
    assert.ok(ids.includes('davin-davidson'));
    assert.ok(ids.includes('tranard-roberts'));
    assert.ok(!ids.includes('xay-mincey'));
    const fl = fp.states.find((s) => s.state === 'FL');
    assert.equal(fl.targets, 1);
    assert.equal(fl.commits, 1);
  });

  it('position rooms group OL and keep EDGE separate from DL', async () => {
    const elite = require('../../lib/recruiting-hub-elite');
    const rooms = await elite.buildHubPositions(2027);
    const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));

    for (const id of ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S']) {
      assert.ok(byId[id], `${id} room must always be present`);
    }
    assert.ok(!byId.OT, 'OT must not be a standalone room');
    assert.ok(!byId.IOL, 'IOL must not be a standalone room');

    // Local seed: Hutcheson OT + Hiller/Miller IOL = OL 3; Wheeler EDGE; 4 interior DL.
    assert.equal(byId.OL.commits, 3);
    assert.match(String(byId.OL.note || ''), /1 OT · 2 IOL/);
    assert.equal(byId.EDGE.commits, 1);
    assert.equal(byId.DL.commits, 4);
  });

  it('getBoard(2027) stays hunt-list only even with polluted admin disk', async () => {
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const { ALLOWLIST_2027 } = require('../../lib/recruiting-target-allowlist');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-board-lock-'));
    const allowPath = path.join(tmp, 'admin-allowlist.json');
    const polluted = ['xay-mincey', 'eric-mcfarland', 'seth-williams'];
    fs.writeFileSync(
      allowPath,
      JSON.stringify({
        version: 1,
        slugs2027: polluted,
        slugs2028: [],
        names: {},
      })
    );
    const prev = process.env.GV_ADMIN_ALLOWLIST_PATH;
    process.env.GV_ADMIN_ALLOWLIST_PATH = allowPath;
    delete require.cache[require.resolve('../../lib/admin-allowlist-store')];
    delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    const store = require('../../lib/recruiting-store');
    const board = await store.getBoard(2027);
    const slugs = (board.targets || []).map((p) => p.slug).sort();
    // Closing Class ignores durable admin.slugs2027 — only the locked hunt list.
    assert.deepEqual(slugs, [...ALLOWLIST_2027].sort());
    for (const slug of polluted) {
      assert.ok(!slugs.includes(slug), `polluted admin slug leaked onto board: ${slug}`);
    }
    if (prev == null) delete process.env.GV_ADMIN_ALLOWLIST_PATH;
    else process.env.GV_ADMIN_ALLOWLIST_PATH = prev;
    delete require.cache[require.resolve('../../lib/admin-allowlist-store')];
    delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
