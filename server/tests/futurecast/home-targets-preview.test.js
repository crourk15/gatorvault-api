'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Home 2028 Targets to watch', () => {
  it('TargetBoardPreview uses high-priority chase board, not underclassmen UF% sort', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'client', 'components', 'futurecast', 'TargetBoardPreview.tsx'),
      'utf8'
    );
    assert.match(src, /fetchHighPriorityTargets/);
    assert.match(src, /fromHighPriorityTarget/);
    assert.doesNotMatch(src, /fetchFutureCastUnderclassmen/);
    assert.doesNotMatch(src, /sortTargets/);
  });

  it('blocks Trace Hawkins soft-promote from the 2028 allowlist merge', () => {
    const { getAllowlistSet, BLOCKED_SOFT_2028 } = require('../../lib/recruiting-target-allowlist');
    assert.ok(BLOCKED_SOFT_2028.has('trace-hawkins'));
    assert.equal(getAllowlistSet(2028).has('trace-hawkins'), false);
  });
});
