'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('Expected visitors profile open speed', () => {
  it('full-profile cook uses lite underclassmen intel and skips Postgres for HS visitors', () => {
    const src = read('server/api/player/build-full-profile.ts');
    assert.match(src, /buildUnderclassmenIntelForSlug\(slug, \{ lite: true \}\)/);
    assert.match(src, /peekRecruitingClassYear/);
    assert.match(src, /isUnderclassmenClassYear\(localYear\)/);
  });

  it('lite intel skips class-wide board + discovery Postgres', () => {
    const src = read('server/lib/underclassmen-intel.ts');
    assert.match(src, /lite\?: boolean/);
    assert.match(src, /RELATED_PEER_LOAD_CAP = lite/);
    assert.match(src, /if \(lite\) \{/);
    assert.match(src, /buildSeedBoardPlayerFromRecruiting/);
    assert.match(src, /if \(!lite && classYear === 2028\)/);
  });

  it('stamp overlay reads local recruiting JSON before Supabase', () => {
    const src = read('server/lib/player-profile-stamp.js');
    assert.match(src, /findBySlug/);
    assert.match(src, /listVisitorStampSlugs/);
    const overlayIdx = src.indexOf('async function loadLiveRecruiting');
    const fallbackIdx = src.indexOf('getRecruitingPlayerBySlug', overlayIdx);
    const localIdx = src.indexOf('findBySlug', overlayIdx);
    assert.ok(localIdx > 0 && localIdx < fallbackIdx, 'local findBySlug must run before TS/Supabase fallback');
  });

  it('Game Week visitor links opt out of scroll-in prefetch', () => {
    const panel = read('client/components/vault/game-week/ExpectedVisitorsPanel.tsx');
    const nav = read('client/components/vault/VaultNavigationProvider.tsx');
    const api = read('client/lib/player-full-profile-api.ts');
    assert.match(panel, /data-no-profile-prefetch/);
    assert.match(nav, /gv-gw-visitors/);
    assert.match(nav, /data-no-profile-prefetch/);
    assert.match(api, /PREFETCH_CONCURRENCY = 2/);
    assert.match(api, /dequeuePrefetch/);
  });

  it('every published visitor slug is a prepared-meal target', () => {
    const stamp = require('../lib/player-profile-stamp');
    const visitors = require('../data/schedule/game-visitors-2026.json');
    const targets = new Set(stamp.listAllowlistStampSlugs());
    const slugs = [
      ...new Set((visitors.games || []).flatMap((g) => g.slugs || [])),
    ].map((s) => String(s).toLowerCase());
    assert.ok(slugs.length >= 20);
    const missing = slugs.filter((s) => !targets.has(s));
    assert.deepEqual(missing, []);
  });
});
