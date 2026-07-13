'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { register } = require('node:module');
const path = require('path');
const { pathToFileURL } = require('node:url');

register(pathToFileURL(path.join(__dirname, 'client-ts-loader.mjs')));

let mod;

before(async () => {
  mod = await import(
    pathToFileURL(path.join(__dirname, '../../client/lib/player-overview-mode.ts')).href
  );
});

describe('player-overview-mode', () => {
  it('HS uncommitted resolves to target with The field context', () => {
    const player = { status: 'HS', committedTo: null, classYear: 2027, highSchool: 'Test HS' };
    const mode = mod.resolveProfileOverviewMode(player);
    assert.equal(mode, 'target');
    const ctx = mod.buildRecruitingContext({
      mode,
      player,
      collegeProfile: null,
      portalProfile: null,
      competingSchools: [{ school: 'Georgia', pct: 40 }],
      futurecastSummary: { on3UfProbability: 35 },
    });
    assert.ok(ctx);
    assert.equal(ctx.title, 'The field');
    assert.ok(ctx.rows.some((r) => r.label === 'Georgia'));
  });

  it('committed to Florida uses commit mode without The field', () => {
    const player = { status: 'HS', committedTo: 'Florida', classYear: 2027 };
    const mode = mod.resolveProfileOverviewMode(player);
    assert.equal(mode, 'commit');
    const ctx = mod.buildRecruitingContext({
      mode,
      player,
      collegeProfile: null,
      portalProfile: null,
      competingSchools: [{ school: 'Georgia', pct: 40 }],
      futurecastSummary: null,
    });
    assert.ok(ctx);
    assert.notEqual(ctx.title, 'The field');
    assert.ok(ctx.rows.some((r) => r.label === 'Commitment' && r.value === 'Florida'));
  });

  it('PORTAL status resolves to portal mode', () => {
    const mode = mod.resolveProfileOverviewMode({ status: 'PORTAL', committedTo: null });
    assert.equal(mode, 'portal');
  });

  it('buildRosterStand avoids board and competing-school language', () => {
    const stand = mod.buildRosterStand({
      name: 'Test Player',
      slug: 'test-player',
      pos: 'WR',
      year: 'JR',
      depthChartTier: 'Starter',
      vaultGrade: 88,
    });
    const blob = JSON.stringify(stand).toLowerCase();
    assert.doesNotMatch(blob, /competing|the field|board leader/);
  });

  it('buildRosterStand uses bio take and skips header-duplicate metrics', () => {
    const stand = mod.buildRosterStand({
      name: 'Brendan Bett',
      slug: 'brendan-bett',
      pos: 'DL',
      year: 'R-Jr.',
      jersey: 90,
      stars: 3,
      depthChartTier: 'rotation',
      bio: "Baylor transfer nose tackle - key piece in Brad White's 3-3-5 front.",
      vaultGrade: 84,
    });
    assert.match(stand.headline, /Baylor transfer nose tackle/i);
    assert.equal(stand.note, 'rotation on the Florida depth chart');
    assert.ok(!stand.metrics.some((m) => /stars|jersey/i.test(m.label)));
    assert.ok(stand.metrics.some((m) => m.label === 'Vault grade'));
  });

  it('buildRosterContext keeps Path only and hides empty context', () => {
    const withPath = mod.buildRosterContext({
      name: 'Brendan Bett',
      slug: 'brendan-bett',
      pos: 'DL',
      year: 'R-Jr.',
      unit: 'defense',
      depthChartTier: 'rotation',
      transferInfo: 'Transfer from Baylor',
    });
    assert.ok(withPath);
    assert.equal(withPath.rows.length, 1);
    assert.equal(withPath.rows[0].label, 'Path');
    assert.ok(!withPath.rows.some((r) => /position|unit|class|depth/i.test(r.label)));

    const empty = mod.buildRosterContext({
      name: 'Homegrown',
      slug: 'homegrown',
      pos: 'WR',
    });
    assert.equal(empty, null);
  });
});
