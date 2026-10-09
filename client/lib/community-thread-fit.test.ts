import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const PAGE = readFileSync(new URL('../components/vault/VaultCommunityPage.tsx', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('./community-elite.css', import.meta.url), 'utf8');

describe('community thread fit', () => {
  it('does not wipe comments on open or re-open the URL thread forever', () => {
    assert.doesNotMatch(PAGE, /setSelectedPosts\(\[\]\);\s*\n\s*setReplyBody/);
    assert.match(PAGE, /previewPostsFromThread/);
    assert.match(PAGE, /shouldShowEmptyReplies/);
    assert.match(PAGE, /selectedIdRef\.current === id/);
    assert.match(PAGE, /COMMUNITY_THREAD_POLL/);
    assert.match(PAGE, /prefetchCommunityThread/);
  });

  it('hides hub chrome on the thread screen', () => {
    assert.match(PAGE, /gv-community-page--thread/);
    assert.match(PAGE, /data-community-view=\{selectedId \? 'thread' : 'hub'\}/);
    assert.match(PAGE, /Open comments →/);
    assert.match(PAGE, /!selectedId \?[\s\S]{0,120}gv-community__toolbar/);
    assert.match(PAGE, /!selectedId \?[\s\S]{0,120}gv-community__aside/);
  });

  it('stops the page from jumping or zooming on iOS', () => {
    assert.doesNotMatch(CSS, /gv-community-hero-in/);
    assert.doesNotMatch(CSS, /animation:\s*gv-community-rise/);
    assert.match(CSS, /overflow-x:\s*clip/);
    assert.match(CSS, /font-size:\s*16px/);
    assert.match(CSS, /gv-community-page--thread/);
  });
});
