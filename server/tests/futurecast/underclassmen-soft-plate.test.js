'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const {
  buildUnderclassmenSoftPlate,
} = require('../../lib/underclassmen-soft-plate');

describe('underclassmen soft plate (2029-30 Names to know)', () => {
  it('builds 2029 store targets + 2030 early-watchlist without status:building', () => {
    const payload = buildUnderclassmenSoftPlate([2028, 2029, 2030]);
    assert.equal(payload.ok, true);
    assert.equal(payload.degraded, 'soft_plate');
    assert.notEqual(payload.status, 'building');
    assert.notEqual(payload.unavailable, true);
    assert.ok(Array.isArray(payload.players));
    assert.ok(payload.players.length > 0, 'soft plate must include underclassmen rows');

    const byYear = {};
    for (const p of payload.players) {
      byYear[p.classYear] = (byYear[p.classYear] || 0) + 1;
    }
    assert.ok((byYear[2029] || 0) >= 1, 'expected Class of 2029 soft rows');
    assert.ok((byYear[2030] || 0) >= 1, 'expected Class of 2030 early-watch rows');

    const withSchool = payload.players.filter(
      (p) => Number(p.classYear) >= 2029 && p.school && String(p.school).trim()
    );
    assert.ok(withSchool.length >= 1, 'younger soft rows need school for Lab gate');
  });


  it('soft plate never sync-parses full players.json', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'underclassmen-soft-plate.js'),
      'utf8'
    );
    assert.doesNotMatch(src, /loadRecruitingPlayersJsonSync/);
    assert.doesNotMatch(src, /resolveRecruitingDataDir/);
    assert.doesNotMatch(src, /['"]players\.json['"]/);
    assert.match(src, /younger-prospects-soft\.json/);
  });

  it('underclassmen GET wires softOnDeferred like Early Discovery', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'underclassmen.ts'),
      'utf8'
    );
    assert.match(src, /softOnDeferred/);
    assert.match(src, /buildUnderclassmenSoftPlate/);
    assert.match(src, /backgroundBuildOnSoft:\s*false/);
    assert.match(src, /primeFuturecastCache/);
  });

  it('Lab Names-to-know panel no longer hides when underclassmen is empty', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'client',
        'components',
        'futurecast',
        'lab',
        'FutureCastExtendedModules.tsx'
      ),
      'utf8'
    );
    assert.match(src, /Names to know/);
    assert.doesNotMatch(
      src,
      /if \(!columns\.some\(\(g\) => g\.players\.length > 0\)\) return null;/
    );
  });
});
