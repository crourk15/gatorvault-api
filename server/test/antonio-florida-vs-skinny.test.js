'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isCorruptRecruitSkinny,
  isPlaceholderSkinny,
} = require('../lib/recruiting-placeholder-school');
const {
  mergeBundledEditorialCopyIfCorrupt,
  BUNDLE_DIR,
} = require('../lib/recruiting-data-dir');
const { validatePlayerIdentityRecord } = require('../lib/identity-record-validator');

describe('Antonio Thomas Jr corrupt Florida vs skinny', () => {
  it('flags game-week Florida vs skinny as corrupt', () => {
    assert.equal(isCorruptRecruitSkinny('Antonio Thomas Jr — 🐊 Florida vs.'), true);
    assert.equal(isPlaceholderSkinny('Antonio Thomas Jr — 🐊 Florida vs.'), true);
    assert.equal(
      isCorruptRecruitSkinny(
        '4★ EDGE · Carrollwood Day (Tampa, FL) · On3 ~No. 17 natl · Florida priority'
      ),
      false
    );
  });

  it('identity validator rejects truncated Florida vs skinny', () => {
    const v = validatePlayerIdentityRecord({
      slug: 'antonio-thomas-jr',
      name: 'Antonio Thomas Jr',
      pos: 'EDGE',
      classYear: 2028,
      school: 'Carrollwood Day (Tampa, FL)',
      skinny: 'Antonio Thomas Jr — 🐊 Florida vs.',
    });
    assert.equal(v.valid, false);
    assert.ok(v.errors.includes('truncated_skinny'));
  });

  it('bundle editorial merge heals durable Florida vs poison', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-antonio-'));
    const durablePath = path.join(tmp, 'players.json');
    const durable = JSON.parse(fs.readFileSync(path.join(BUNDLE_DIR, 'players.json'), 'utf8'));
    const idx = durable.findIndex((p) => p.slug === 'antonio-thomas-jr');
    assert.ok(idx >= 0);
    durable[idx].skinny = 'Antonio Thomas Jr — 🐊 Florida vs.';
    durable[idx].profileNote =
      "Antonio Thomas Jr. remains on Florida's priority EDGE board. Antonio Thomas Jr — 🐊 Florida vs.";
    fs.writeFileSync(durablePath, JSON.stringify(durable));
    const result = mergeBundledEditorialCopyIfCorrupt(tmp);
    assert.equal(result.merged, true);
    const healed = JSON.parse(fs.readFileSync(durablePath, 'utf8')).find(
      (p) => p.slug === 'antonio-thomas-jr'
    );
    assert.match(healed.skinny, /Carrollwood Day/i);
    assert.equal(isCorruptRecruitSkinny(healed.skinny), false);
    assert.doesNotMatch(healed.profileNote || '', /Florida vs/i);
  });
});
