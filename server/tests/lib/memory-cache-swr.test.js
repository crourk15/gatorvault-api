const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryCache } = require('../../lib/memory-cache');

describe('memory-cache stale-while-revalidate', () => {
  it('returns fresh hits without rebuilding', async () => {
    const cache = createMemoryCache(60_000);
    let builds = 0;
    const first = await cache.wrap('k', async () => {
      builds += 1;
      return { n: 1 };
    });
    const second = await cache.wrap('k', async () => {
      builds += 1;
      return { n: 2 };
    });
    assert.equal(first.hit, false);
    assert.equal(second.hit, true);
    assert.equal(second.stale, false);
    assert.equal(builds, 1);
    assert.deepEqual(second.value, { n: 1 });
  });

  it('serves stale immediately and rebuilds in background', async () => {
    const cache = createMemoryCache(40);
    await cache.wrap('k', async () => ({ n: 1 }));
    await new Promise((r) => setTimeout(r, 50));
    let builds = 0;
    const stale = await cache.wrap('k', async () => {
      builds += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { n: 2 };
    });
    assert.equal(stale.hit, true);
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.value, { n: 1 });
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(builds, 1);
    const fresh = await cache.wrap('k', async () => {
      builds += 1;
      return { n: 3 };
    });
    assert.equal(fresh.hit, true);
    assert.equal(fresh.stale, false);
    assert.deepEqual(fresh.value, { n: 2 });
    assert.equal(builds, 1);
  });

  it('single-flights concurrent cold misses', async () => {
    const cache = createMemoryCache(60_000);
    let builds = 0;
    const builder = async () => {
      builds += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { n: builds };
    };
    const [a, b, c] = await Promise.all([
      cache.wrap('cold', builder),
      cache.wrap('cold', builder),
      cache.wrap('cold', builder),
    ]);
    assert.equal(builds, 1);
    assert.equal(a.hit, false);
    assert.equal(b.hit, false);
    assert.equal(c.hit, false);
    assert.deepEqual(a.value, b.value);
    assert.deepEqual(b.value, c.value);
  });
});
