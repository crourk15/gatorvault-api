const assert = require('assert');
const {
  normalizeAllowlistSlug,
  dedupeAllowlistSlugs,
  buildAllowlistSlugAliasLookup,
} = require('../lib/allowlist-slug-aliases');

assert.strictEqual(normalizeAllowlistSlug('zyon-robinson-251054'), 'zyon-robinson');
assert.strictEqual(normalizeAllowlistSlug('zyon-robinson'), 'zyon-robinson');
assert.strictEqual(normalizeAllowlistSlug('xander-edwards'), 'xander-edwards');

const deduped = dedupeAllowlistSlugs(['zyon-robinson', 'zyon-robinson-251054', 'xander-edwards'], 2028);
assert.deepStrictEqual(deduped, ['zyon-robinson', 'xander-edwards']);

const lookup = buildAllowlistSlugAliasLookup(['zyon-robinson'], 2028);
assert.strictEqual(lookup.get('zyon-robinson'), 'zyon-robinson');
assert.strictEqual(lookup.get('zyon-robinson-251054'), 'zyon-robinson');

console.log('allowlist-slug-aliases tests passed');
