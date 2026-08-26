const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-edit-'));
process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
delete require.cache[require.resolve('../lib/community-store')];
const store = require('../lib/community-store');

const authorSession = { email: 'author@example.com', name: 'Author One' };
const otherSession = { email: 'other@example.com', name: 'Other Member' };

describe('community author edit + delete', () => {
  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  before(() => {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(store.DATA_DIR, 'users.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'posts.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'categories.json'), JSON.stringify(store.defaultCategories()));
  });

  it('author can edit and soft-delete own thread; others cannot', () => {
    const created = store.createThread(authorSession, {
      title: 'Original title',
      body: 'Original body for the board.',
      categorySlug: 'locker',
    });
    const threadId = created.thread.id;

    const edited = store.editThread(authorSession, threadId, {
      title: 'Updated title',
      body: 'Updated body for the board.',
    });
    assert.equal(edited.thread.title, 'Updated title');
    assert.equal(edited.thread.body, 'Updated body for the board.');
    assert.ok(edited.thread.editedAt);

    assert.throws(
      () => store.editThread(otherSession, threadId, { title: 'Hijack', body: 'Nope' }),
      (err) => err && err.statusCode === 403,
    );

    assert.throws(
      () => store.deleteThread(otherSession, threadId),
      (err) => err && err.statusCode === 403,
    );

    const deleted = store.deleteThread(authorSession, threadId);
    assert.equal(deleted.thread.deleted, true);
    assert.equal(store.getThreadById(threadId), null);
  });

  it('author can edit and soft-delete own reply; others cannot', () => {
    const created = store.createThread(authorSession, {
      title: 'Thread for replies',
      body: 'Opener.',
      categorySlug: 'war',
    });
    const reply = store.createReply(authorSession, created.thread.id, 'First reply here.');
    const postId = reply.post.id;

    const edited = store.editPost(authorSession, postId, { body: 'Edited reply here.' });
    assert.equal(edited.post.body, 'Edited reply here.');
    assert.ok(edited.post.editedAt);

    assert.throws(
      () => store.editPost(otherSession, postId, { body: 'Stolen' }),
      (err) => err && err.statusCode === 403,
    );

    assert.throws(
      () => store.deletePost(otherSession, postId),
      (err) => err && err.statusCode === 403,
    );

    const before = store.getThreadById(created.thread.id, false);
    assert.equal(before.thread.replyCount, 1);

    const deleted = store.deletePost(authorSession, postId);
    assert.equal(deleted.post.deleted, true);

    const after = store.getThreadById(created.thread.id, false);
    assert.equal(after.thread.replyCount, 0);
    assert.equal(after.posts.length, 0);
  });
});
