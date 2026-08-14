'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const store = require('../lib/recruiting-store');

describe('recruiting-store stars preserve', () => {
  it('does not coerce missing stars to 0 on normalize', () => {
    const n = store.normalizePlayer({ slug: 'x', name: 'X', visits: [] });
    assert.equal(n.stars, null);
  });

  it('keeps existing stars when partial upsert omits stars', () => {
    const existing = { slug: 'davian-groce', name: 'Davian Groce', stars: 4, starsDisplay: '★★★★' };
    const incoming = store.normalizePlayer({ slug: 'davian-groce', name: 'Davian Groce', visits: [{ school: 'Florida' }] });
    const merged = store.preservePlayerFields(existing, incoming);
    assert.equal(merged.stars, 4);
  });

  it('keeps existing stars when incoming stars is 0', () => {
    const existing = { slug: 'davian-groce', name: 'Davian Groce', stars: 4 };
    const incoming = store.normalizePlayer({ slug: 'davian-groce', name: 'Davian Groce', stars: 0 });
    const merged = store.preservePlayerFields(existing, incoming);
    assert.equal(merged.stars, 4);
  });
});
