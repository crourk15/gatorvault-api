'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

describe('player profile no-slash Netlify 500', () => {
  it('edge function 308s browser no-slash player URLs to the slash shell', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'netlify/edge-functions/player-share-bots.js'),
      'utf8'
    );
    assert.match(src, /match\[2\] !== '\/'/);
    assert.match(src, /Response\.redirect\(url\.toString\(\), 308\)/);
    assert.match(src, /BOT_RE\.test\(ua\)/);
  });

  it('visitor / profile hrefs use a trailing slash', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/lib/vault-route-map.ts'), 'utf8');
    assert.match(src, /`\/vault\/recruiting\/player\/\$\{safe\}\/`/);
    assert.match(src, /`\/vault\/futurecast\/player\/\$\{safe\}\/`/);
    assert.match(src, /`\/vault\/players\/\$\{safe\}\/`/);
  });

  it('redirect table 301s no-slash player paths', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/lib/routes-vault.cjs'), 'utf8');
    assert.match(
      src,
      /\/vault\/recruiting\/player\/:slug'\s*,\s*to:\s*'\/vault\/recruiting\/player\/:slug\//
    );
    const redirects = fs.readFileSync(path.join(ROOT, 'server/_redirects'), 'utf8');
    assert.match(
      redirects,
      /\/vault\/recruiting\/player\/:slug\s+\/vault\/recruiting\/player\/:slug\/\s+301/
    );
  });
});
