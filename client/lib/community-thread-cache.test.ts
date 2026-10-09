import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COMMUNITY_THREAD_POLL,
  clearCachedCommunityThread,
  peekCachedCommunityThread,
  writeCachedCommunityThread,
} from './community-api';

describe('community thread cache', () => {
  it('keeps the thread poll short so a tap does not wait 20s', () => {
    assert.equal(COMMUNITY_THREAD_POLL.maxAttempts, 3);
    assert.ok(COMMUNITY_THREAD_POLL.delayMs <= 700);
  });

  it('peeks a written thread and clears it after a reply', () => {
    clearCachedCommunityThread();
    writeCachedCommunityThread('thr_1', {
      thread: { id: 'thr_1', title: 'Game day talk' },
      posts: [{ id: 'p_billy', body: 'ABC 3:30', authorDisplay: 'Billy Moody' }],
      following: true,
    });
    const hit = peekCachedCommunityThread('thr_1');
    assert.equal(hit?.thread.title, 'Game day talk');
    assert.equal(hit?.posts[0]?.authorDisplay, 'Billy Moody');
    clearCachedCommunityThread('thr_1');
    assert.equal(peekCachedCommunityThread('thr_1'), null);
  });

  it('returns no cache for a blank id', () => {
    assert.equal(peekCachedCommunityThread(''), null);
    assert.equal(peekCachedCommunityThread('   '), null);
  });
});
