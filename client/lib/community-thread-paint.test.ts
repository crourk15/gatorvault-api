import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { previewPostsFromThread, shouldShowEmptyReplies } from './community-thread-paint';

describe('community thread paint', () => {
  it('builds a preview comment from the list last-reply', () => {
    const posts = previewPostsFromThread({
      id: 'thr_1',
      title: 'Game day talk',
      lastReply: {
        id: 'p_billy',
        authorDisplay: 'Billy Moody',
        bodyPreview: 'ABC 3:30',
        createdAt: '2026-10-04T19:00:00.000Z',
      },
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, 'p_billy');
    assert.equal(posts[0].authorDisplay, 'Billy Moody');
    assert.match(posts[0].body, /ABC/);
  });

  it('returns no preview when the thread has no last reply', () => {
    assert.deepEqual(previewPostsFromThread({ id: 'thr_1', title: 'Open' }), []);
    assert.deepEqual(previewPostsFromThread(null), []);
  });

  it('hides the empty-replies flash while the thread is loading', () => {
    assert.equal(shouldShowEmptyReplies({ postCount: 0, threadLoading: true }), false);
    assert.equal(shouldShowEmptyReplies({ postCount: 0, threadLoading: false }), true);
    assert.equal(shouldShowEmptyReplies({ postCount: 2, threadLoading: false }), false);
  });
});
