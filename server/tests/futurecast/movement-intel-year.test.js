const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

const { buildMovementIntelPayload } = require('../../api/futurecast/allowlist-board.ts');

describe('buildMovementIntelPayload year scoping', () => {
  it('defaults to closing class 2027', async () => {
    const payload = await buildMovementIntelPayload();
    assert.equal(payload.classYear, 2027);
    assert.ok(Array.isArray(payload.risers));
    assert.ok(Array.isArray(payload.fallers));
  });

  it('builds discovery-class movement for 2028 without UF commits', async () => {
    const payload = await buildMovementIntelPayload(2028);
    assert.equal(payload.classYear, 2028);
    assert.ok(Array.isArray(payload.risers));
    const names = [...payload.risers, ...payload.fallers, ...payload.highVolatility].map(
      (p) => String(p.name || p.slug || '').toLowerCase()
    );
    assert.equal(
      names.some((n) => n.includes('armani') && n.includes('strong')),
      false,
      'UF commit Armani Strong must not appear as a discovery mover'
    );
  });
});
