/**
 * On3 / Gators Online narrative headlines must resolve prospect identity.
 * Run: node --test server/test/uf-on3-news-allen-identity.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseOn3NewsArticleSlug } = require('../lib/on3-recruit-discovery');
const { parseArticleIdentity, buildSyntheticBeatPostFromOn3Article } = require('../lib/uf-on3-news-discovery');
const { collectBeatCandidates } = require('../lib/vault-feed-2028-sweep');

describe('On3 article identity for narrative GO headlines', () => {
  it('parses embedded james-allen before has-deep narrative', () => {
    const slug = '6-foot-2-5-cb-10-9-speed-and-nearly-50-offers-james-allen-has-deep-florida-gators-ties';
    const parsed = parseOn3NewsArticleSlug(slug);
    // Mid-slug may still miss; title fallback must catch.
    const art = {
      title: '6-foot-2.5 CB, 10.9 speed and nearly 50 offers — James Allen has deep Florida Gators ties',
      excerpt: 'The Tampa corner has nearly 50 offers.',
      slug,
      author: { name: 'Corey Bender' },
      postDateGMT: new Date().toISOString(),
    };
    const id = parseArticleIdentity(art);
    assert.equal(id.playerName, 'James Allen');
    assert.equal(id.playerSlug, 'james-allen');
    const syn = buildSyntheticBeatPostFromOn3Article(art, id);
    assert.match(syn.text, /James Allen/i);
    assert.equal(syn.handle, 'corey_bender');
    const rows = collectBeatCandidates([syn], { lookbackHours: 96 });
    assert.ok(rows.some((r) => r.kind === 'named' && /james allen/i.test(r.playerName)));
  });

  it('parses for-2029-rb-james-allen style slugs', () => {
    const parsed = parseOn3NewsArticleSlug('florida-still-in-strong-position-for-2029-rb-james-allen');
    assert.equal(parsed?.playerSlug, 'james-allen');
    assert.equal(parsed?.classYear, 2029);
  });
});
