/** API cache policy — hub bundle/ticker get CDN TTL; intel paths stay fresh. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { cacheControlForPath } = require('../../lib/api-cache-policy');

test('hub bundle gets CDN-friendly cache headers', () => {
  const cc = cacheControlForPath('/api/recruiting/hub/bundle');
  assert.match(cc, /s-maxage=90/);
  assert.match(cc, /stale-while-revalidate=120/);
});

test('hub ticker and class-overview get short CDN TTL', () => {
  assert.match(cacheControlForPath('/api/recruiting/hub/ticker'), /s-maxage=90/);
  assert.match(cacheControlForPath('/api/recruiting/hub/class-overview'), /s-maxage=90/);
});

test('generic recruiting paths stay no-store', () => {
  const cc = cacheControlForPath('/api/recruiting/intel/beat');
  assert.match(cc, /no-store/);
});

test('ping stays no-store', () => {
  const cc = cacheControlForPath('/api/ping');
  assert.match(cc, /no-store/);
});
