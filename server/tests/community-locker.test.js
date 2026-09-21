'use strict';

const { describe, it, after, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-locker-'));
process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
delete require.cache[require.resolve('../lib/community-store')];
const store = require('../lib/community-store');

const charles = { email: 'charles@gatorvaultinsider.com', name: 'Charles' };
const fan = { email: 'fan@example.com', name: 'SwampFan' };

describe('community locker and game talk', () => {
  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  before(() => {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'posts.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'users.json'), '[]');
    fs.writeFileSync(path.join(store.DATA_DIR, 'follows.json'), '[]');
  });

  it('auto-follows when a member starts a thread', () => {
    const { thread } = store.createThread(charles, {
      title: 'Auburn first half — what are you seeing?',
      body: 'Baugh through the B-gap. Drop your read.',
      categorySlug: 'locker',
    });
    assert.ok(thread.id);
    assert.deepEqual(store.getFollowedThreadIds(charles.email), [thread.id]);
  });

  it('auto-follows when a member replies and locker lists You commented', () => {
    const daily = store.ensureDailyOpenThread();
    const reply = store.createReply(charles, daily.thread.id, 'Philo looks settled.');
    assert.ok(reply.post.id);
    assert.ok(store.getFollowedThreadIds(charles.email).includes(daily.thread.id));

    const me = store.getMyCommunity(charles);
    assert.equal(me.user.email, charles.email);
    assert.ok(me.locker.some((t) => t.id === daily.thread.id && t.yourRole === 'replied'));
    const row = me.locker.find((t) => t.id === daily.thread.id);
    assert.equal(row.yourReplyCount, 1);
    assert.equal(row.lastReply.isYours, true);
  });

  it('repliesOnYours is honest — only someone else on your thread', () => {
    const { thread } = store.createThread(charles, {
      title: 'Game time: who wins the line?',
      body: 'Watch the first drive.',
      categorySlug: 'locker',
    });
    store.createReply(fan, thread.id, 'I think Florida owns the A-gap.');
    const me = store.getMyCommunity(charles);
    const ping = me.repliesOnYours.find((r) => r.threadId === thread.id);
    assert.ok(ping);
    assert.equal(ping.lastReplyAuthor, 'SwampFan');
    assert.match(ping.lastReplyPreview, /A-gap/);
    const row = me.locker.find((t) => t.id === thread.id);
    assert.equal(row.lastReply.isYours, false);
    assert.equal(row.lastReply.authorDisplay, 'SwampFan');
  });

  it('getGameRooms keeps Saturday talk after Monday daily open unpins it', () => {
    const threads = store.loadThreads();
    threads.unshift({
      id: 'thr_gameday_auburn',
      title: 'Game day talk: Florida vs Auburn',
      body: 'Jordan-Hare. Talk it now, during the game, and after.',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: 'usr_gv_staff',
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      locked: false,
      featured: false,
      gameday: true,
      replyCount: 1,
      viewCount: 0,
      lastActivityAt: '2026-09-19T23:10:00.000Z',
      createdAt: '2026-09-19T16:00:00.000Z',
      deleted: false,
      dailyKey: '2026-09-19',
    });
    store.saveThreads(threads);
    const posts = store.loadPosts();
    posts.push({
      id: 'pst_charles_auburn',
      threadId: 'thr_gameday_auburn',
      authorId: store.getOrCreateUser(charles).id,
      authorEmail: charles.email,
      body: 'That third-and-short was the game.',
      flagged: false,
      deleted: false,
      createdAt: '2026-09-19T23:08:00.000Z',
    });
    fs.writeFileSync(path.join(store.DATA_DIR, 'posts.json'), JSON.stringify(posts, null, 2));

    const monday = store.ensureDailyOpenThread({ asOf: '2026-09-21T14:00:00.000Z', dayKey: '2026-09-21' });
    assert.equal(monday.thread.dailyKey, '2026-09-21');
    const auburn = store.loadThreads().find((t) => t.id === 'thr_gameday_auburn');
    assert.equal(auburn.pinned, false);

    const rooms = store.getGameRooms({ limit: 8, viewerEmail: charles.email });
    const auburnRoom = rooms.find((t) => t.id === 'thr_gameday_auburn');
    assert.ok(auburnRoom, 'Saturday Auburn talk must stay in Game talk after Monday rolls');
    assert.equal(auburnRoom.gameday, true);
    assert.equal(auburnRoom.lastReply.isYours, true);
    assert.match(auburnRoom.lastReply.bodyPreview, /third-and-short/);

    const me = store.getMyCommunity(charles);
    assert.ok(me.gameRooms.some((t) => t.id === 'thr_gameday_auburn'));
  });
});
