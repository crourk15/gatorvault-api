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
});
