'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('HP DISK serve must not rebuild in-request', () => {
  it('does not schedule buildHighPriorityPayload after DISK heal', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /Do NOT background/);
    assert.equal(
      /scheduleHighPriorityDiskRebuild\(classYear/.test(src),
      false,
      'DISK path must not schedule full HP rebuild'
    );
    assert.match(src, /writeHighPriorityRuntime\(classYear, healed\)/);
  });
});
