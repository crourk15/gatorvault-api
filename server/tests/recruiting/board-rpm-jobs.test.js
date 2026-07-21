const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { allowlistJobsFromFiles, profilePatchFromOn3 } = require('../../lib/allowlist-target-sync');
const { loadTargetBoard, persistRpmToRecruitingStore } = require('../../lib/on3-rpm-allowlist');

describe('Closing Class / Lab RPM job coverage', () => {
  it('allowlistJobsFromFiles includes Closing Class snapshot slugs', () => {
    const jobs = allowlistJobsFromFiles();
    const slugs = new Set(jobs.filter((j) => j.classYear === 2027).map((j) => j.slug));
    assert.ok(slugs.has('tranard-roberts'), 'curated allowlist still present');
    assert.ok(slugs.has('seth-williams'), 'Closing Class board slug should sync RPM');
    assert.ok(slugs.has('monshun-sales'), 'Closing Class board slug should sync RPM');
    assert.ok(slugs.has('brayden-parks'), 'Closing Class board slug should sync RPM');
  });

  it('profilePatchFromOn3 extracts UF RPM + competitors for Lab logos', () => {
    const patch = profilePatchFromOn3(
      {
        name: 'Seth Williams',
        topTeams: [
          { year: 2027, prediction: 18, team: { name: 'Florida Gators', fullName: 'Florida' } },
          { year: 2027, prediction: 42, team: { name: 'Georgia Bulldogs', fullName: 'Georgia' } },
          { year: 2027, prediction: 22, team: { name: 'Auburn Tigers', fullName: 'Auburn' } },
        ],
        rankingsPlayer: { consensusStars: 4 },
      },
      2027
    );
    assert.equal(patch.ufRpmPct, 18);
    assert.ok((patch.competitors || []).some((c) => /georgia/i.test(c.school)));
  });

  it('on3-rpm loadTargetBoard includes Closing Class open board', () => {
    const targets = loadTargetBoard(2027);
    const slugs = new Set(targets.map((t) => String(t.slug || '').toLowerCase()));
    assert.ok(slugs.has('seth-williams'));
    assert.ok(slugs.has('monshun-sales'));
    assert.ok(slugs.has('tranard-roberts'));
  });

  it('persistRpmToRecruitingStore writes competitors onto Closing Class rows', async () => {
    const store = require('../../lib/recruiting-store');
    const before = await store.getPlayerBySlug('seth-williams');
    assert.ok(before, 'fixture player seth-williams should exist in local store');

    try {
      const out = await persistRpmToRecruitingStore(
        'seth-williams',
        2027,
        {
          name: 'Seth Williams',
          slug: 'seth-williams-284423',
          topTeams: [
            { year: 2027, prediction: 15, team: { name: 'Florida Gators', fullName: 'Florida' } },
            { year: 2027, prediction: 55, team: { name: 'Georgia Bulldogs', fullName: 'Georgia' } },
          ],
          rankingsPlayer: { consensusStars: 4, playerId: 284423 },
        },
        15
      );
      assert.equal(out.ok, true);
      assert.equal(out.ufRpmPct, 15);
      assert.ok(out.competitors >= 1);

      const player = await store.getPlayerBySlug('seth-williams');
      assert.equal(player.ufRpmPct, 15);
      assert.ok((player.competitors || []).some((c) => /georgia/i.test(c.school || c.name || '')));
      assert.equal(player.boardSource, '247-uf-board-sync');
    } finally {
      if (before) {
        await store.upsertPlayer({
          ...before,
          boardSource: before.boardSource || '247-uf-board-sync',
        });
      }
    }
  });
});
