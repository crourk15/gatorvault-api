const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFallbackUrl,
  looksLikeCloudflare,
  hasNextData,
  fallbackBase,
} = require('../../lib/on3-fetch');

describe('on3-fetch helpers', () => {
  it('builds jina fallback url', () => {
    const target = 'https://www.on3.com/college/florida-gators/football/2027/commits/';
    const out = buildFallbackUrl(target);
    assert.equal(out, `${fallbackBase()}${target}`);
  });

  it('detects cloudflare challenge html', () => {
    assert.equal(looksLikeCloudflare('<title>Attention Required! | Cloudflare</title>', 403), true);
    assert.equal(looksLikeCloudflare('<html>ok</html>', 200), false);
    assert.equal(looksLikeCloudflare('<div id="cf-browser-verification"></div>', 200), true);
  });

  it('detects Next.js data script', () => {
    assert.equal(hasNextData('<script id="__NEXT_DATA__" type="application/json">{}</script>'), true);
    assert.equal(hasNextData('<html>nope</html>'), false);
  });
});
