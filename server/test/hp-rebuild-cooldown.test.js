'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('HP disk rebuild cooldown', () => {
  it('stamps cooldown before build so failures do not stampede', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /Stamp cooldown immediately/);
    assert.match(
      src,
      /hpDiskRebuildAt\.set\(classYear, now\);[\s\S]*Promise\.resolve\(\)\s*\.then\(\(\) => build\(\)\)/
    );
  });
});

describe('board-truth merge deferral', () => {
  it('defers On3 board-truth merge off sync migrate path', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'recruiting-data-dir.js'), 'utf8');
    assert.match(src, /deferred On3 board-truth|Defer board-truth merge/);
    assert.match(src, /setTimeout\(\(\) => \{[\s\S]*mergeBundledOn3BoardTruthIfFresher/);
  });
});
