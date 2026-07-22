const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { allowlistJobsFromFiles, profilePatchFromOn3 } = require('../../lib/allowlist-target-sync');
const { loadTargetBoard, persistRpmToRecruitingStore } = require('../../lib/on3-rpm-allowlist');

describe('Closing Class / Lab RPM job coverage', () => {
  it('allowlistJobsFromFiles is hunt-list only for 2027 (no 247 offer dump)', () => {
    const jobs = allowlistJobsFromFiles();
    const slugs = new Set(jobs.filter((j) => j.classYear === 2027).map((j) => j.slug));
    assert.ok(slugs.has('tranard-roberts'), 'curated hunt target present');
    assert.ok(slugs.has('jalen-brewster'), 'flip-watch hunt target present');
    assert.ok(!slugs.has('seth-williams'), 'offer-list noise must not become a sync job');
    assert.ok(!slugs.has('monshun-sales'), 'elsewhere-commit must not become a sync job');
    assert.ok(!slugs.has('brayden-parks'), 'offer-list noise must not become a sync job');
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

  it('on3-rpm loadTargetBoard is hunt-list only for 2027', () => {
    const targets = loadTargetBoard(2027);
    const slugs = new Set(targets.map((t) => String(t.slug || '').toLowerCase()));
    assert.ok(slugs.has('tranard-roberts'));
    assert.ok(slugs.has('jalen-brewster'));
    assert.ok(!slugs.has('seth-williams'));
    assert.ok(!slugs.has('monshun-sales'));
  });

  it('persistRpmToRecruitingStore writes competitors onto hunt-list rows', async () => {
    const store = require('../../lib/recruiting-store');
    const before = await store.getPlayerBySlug('tranard-roberts');
    assert.ok(before, 'fixture player tranard-roberts should exist in local store');

    try {
      const out = await persistRpmToRecruitingStore(
        'tranard-roberts',
        2027,
        {
          name: 'Tranard Roberts',
          slug: 'tranard-roberts',
          topTeams: [
            { year: 2027, prediction: 15, team: { name: 'Florida Gators', fullName: 'Florida' } },
            { year: 2027, prediction: 55, team: { name: 'Georgia Bulldogs', fullName: 'Georgia' } },
          ],
          rankingsPlayer: { consensusStars: 3, playerId: 1 },
        },
        15
      );
      assert.equal(out.ok, true);
      assert.equal(out.ufRpmPct, 15);
      assert.ok(out.competitors >= 1);

      const player = await store.getPlayerBySlug('tranard-roberts');
      assert.equal(player.ufRpmPct, 15);
      assert.ok((player.competitors || []).some((c) => /georgia/i.test(c.school || c.name || '')));
    } finally {
      if (before) {
        await store.upsertPlayer({ ...before });
      }
    }
  });
});
