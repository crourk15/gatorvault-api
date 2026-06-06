const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'community');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const THREADS_PATH = path.join(DATA_DIR, 'threads.json');
const POSTS_PATH = path.join(DATA_DIR, 'posts.json');
const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');
const LIVE_ROOMS_PATH = path.join(DATA_DIR, 'live_rooms.json');
const LIVE_MESSAGES_PATH = path.join(DATA_DIR, 'live_messages.json');
const FLAGS_PATH = path.join(DATA_DIR, 'flags.json');
const FOLLOWS_PATH = path.join(DATA_DIR, 'follows.json');

const TIER_BADGE = {
  locker: { badge: '🏟️ LOCKER ROOM', badgeClass: 'tier-locker' },
  film: { badge: '🎬 FILM ROOM', badgeClass: 'tier-film' },
  war: { badge: '⚔️ WAR ROOM', badgeClass: 'tier-war' },
  founding: { badge: '🏅 FOUNDING', badgeClass: 'tier-founding' }
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function trendingScore(thread) {
  const hours = (Date.now() - new Date(thread.lastActivityAt || thread.createdAt).getTime()) / 3600000;
  const recencyBoost = Math.max(0, 48 - hours) * 0.5;
  return (thread.replyCount || 0) * 2 + (thread.viewCount || 0) * 0.1 + recencyBoost;
}

function sortThreads(threads, sort) {
  const list = threads.slice();
  const pin = (t) => (t.pinned ? 1 : 0);
  if (sort === 'recent') {
    return list.sort(
      (a, b) => pin(b) - pin(a) || new Date(b.lastActivityAt) - new Date(a.lastActivityAt)
    );
  }
  if (sort === 'active') {
    return list.sort(
      (a, b) =>
        pin(b) - pin(a) ||
        (b.replyCount || 0) + (b.viewCount || 0) - ((a.replyCount || 0) + (a.viewCount || 0))
    );
  }
  if (sort === 'replies') {
    return list.sort((a, b) => pin(b) - pin(a) || (b.replyCount || 0) - (a.replyCount || 0));
  }
  return list.sort((a, b) => pin(b) - pin(a) || trendingScore(b) - trendingScore(a));
}

function defaultCategories() {
  return [
    { id: 'cat_film', slug: 'film', name: 'Film Room', badgeLabel: '🎬 FILM ROOM', badgeClass: 'tier-film', sortOrder: 1 },
    { id: 'cat_locker', slug: 'locker', name: 'Locker Room', badgeLabel: '🏟️ LOCKER ROOM', badgeClass: 'tier-locker', sortOrder: 2 },
    { id: 'cat_war', slug: 'war', name: 'War Room', badgeLabel: '⚔️ WAR ROOM', badgeClass: 'tier-war', sortOrder: 3 },
    { id: 'cat_founding', slug: 'founding', name: 'Founding', badgeLabel: '🏅 FOUNDING', badgeClass: 'tier-founding', sortOrder: 4 }
  ];
}

function ensureCategories() {
  let cats = readJson(CATEGORIES_PATH, null);
  if (!cats || !cats.length) {
    cats = defaultCategories();
    writeJson(CATEGORIES_PATH, cats);
  }
  return cats;
}

function loadUsers() {
  return readJson(USERS_PATH, []);
}

function saveUsers(users) {
  writeJson(USERS_PATH, users);
}

function loadThreads() {
  return readJson(THREADS_PATH, []);
}

function saveThreads(threads) {
  writeJson(THREADS_PATH, threads);
}

function loadPosts() {
  return readJson(POSTS_PATH, []);
}

function savePosts(posts) {
  writeJson(POSTS_PATH, posts);
}

function loadFollows() {
  return readJson(FOLLOWS_PATH, []);
}

function saveFollows(follows) {
  writeJson(FOLLOWS_PATH, follows);
}

function loadFlags() {
  return readJson(FLAGS_PATH, []);
}

function saveFlags(flags) {
  writeJson(FLAGS_PATH, flags);
}

function loadLiveRooms() {
  return readJson(LIVE_ROOMS_PATH, []);
}

function saveLiveRooms(rooms) {
  writeJson(LIVE_ROOMS_PATH, rooms);
}

function loadLiveMessages() {
  return readJson(LIVE_MESSAGES_PATH, []);
}

function saveLiveMessages(messages) {
  writeJson(LIVE_MESSAGES_PATH, messages);
}

function getCategoryMap() {
  const map = {};
  ensureCategories().forEach((c) => {
    map[c.id] = c;
    map[c.slug] = c;
  });
  return map;
}

function badgeForUser(user) {
  if (user.isFounding) return TIER_BADGE.founding;
  const tier = user.tier || 'locker';
  return TIER_BADGE[tier] || TIER_BADGE.locker;
}

function getOrCreateUser(session) {
  const users = loadUsers();
  const email = String(session.email || '').toLowerCase();
  let user = users.find((u) => u.email === email);
  if (!user) {
    const foundingCount = users.filter((u) => u.isFounding).length;
    user = {
      id: newId('usr'),
      email,
      displayName: session.name || email.split('@')[0],
      avatarUrl: null,
      tier: session.tier || 'locker',
      isFounding: foundingCount < 100,
      joinDate: nowIso(),
      createdAt: nowIso()
    };
    users.push(user);
    saveUsers(users);
  } else if (session.name && user.displayName !== session.name) {
    user.displayName = session.name;
    user.tier = session.tier || user.tier;
    saveUsers(users);
  }
  return user;
}

function enrichThread(thread, categoryMap) {
  const cat = categoryMap[thread.categoryId] || categoryMap[thread.categorySlug];
  return {
    ...thread,
    category: cat || null,
    trendingScore: Math.round(trendingScore(thread) * 10) / 10
  };
}

function enrichThreadWithAuthor(thread, categoryMap, users) {
  const enriched = enrichThread(thread, categoryMap);
  const author = users.find((u) => u.id === thread.authorId);
  if (author) {
    const badge = badgeForUser(author);
    enriched.author = {
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      tier: author.tier,
      isFounding: author.isFounding,
      joinDate: author.joinDate
    };
    enriched.badge = badge.badge;
    enriched.badgeClass = badge.badgeClass;
  }
  return enriched;
}

function getThreads({ sort = 'trending', category, limit = 50 } = {}) {
  ensureCategories();
  const categoryMap = getCategoryMap();
  const users = loadUsers();
  let threads = loadThreads().filter((t) => !t.deleted);
  if (category) {
    threads = threads.filter((t) => t.categorySlug === category || t.categoryId === category);
  }
  threads = sortThreads(threads, sort).slice(0, limit);
  return threads.map((t) => enrichThreadWithAuthor(t, categoryMap, users));
}

function getThreadById(id, incrementView = false) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === id && !t.deleted);
  if (idx < 0) return null;
  if (incrementView) {
    threads[idx].viewCount = (threads[idx].viewCount || 0) + 1;
    saveThreads(threads);
  }
  const categoryMap = getCategoryMap();
  const posts = loadPosts()
    .filter((p) => p.threadId === id && !p.deleted)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const users = loadUsers();
  const author = users.find((u) => u.id === threads[idx].authorId);
  return {
    thread: enrichThread(threads[idx], categoryMap),
    posts: posts.map((p) => {
      const pu = users.find((u) => u.id === p.authorId);
      const badge = pu ? badgeForUser(pu) : TIER_BADGE.locker;
      return {
        ...p,
        author: pu
          ? {
              displayName: pu.displayName,
              avatarUrl: pu.avatarUrl,
              tier: pu.tier,
              isFounding: pu.isFounding,
              joinDate: pu.joinDate
            }
          : null,
        badge: badge.badge,
        badgeClass: badge.badgeClass
      };
    }),
    author: author
      ? (() => {
          const badge = badgeForUser(author);
          return {
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
            tier: author.tier,
            isFounding: author.isFounding,
            joinDate: author.joinDate,
            badge: badge.badge,
            badgeClass: badge.badgeClass
          };
        })()
      : null
  };
}

function createThread(session, { title, body, categorySlug }) {
  const user = getOrCreateUser(session);
  const cats = ensureCategories();
  const cat = cats.find((c) => c.slug === categorySlug) || cats[0];
  const threads = loadThreads();
  const thread = {
    id: newId('thr'),
    title: String(title || '').trim(),
    body: String(body || '').trim(),
    categoryId: cat.id,
    categorySlug: cat.slug,
    authorId: user.id,
    authorEmail: user.email,
    pinned: false,
    locked: false,
    featured: false,
    replyCount: 0,
    viewCount: 0,
    lastActivityAt: nowIso(),
    createdAt: nowIso(),
    deleted: false
  };
  if (!thread.title || !thread.body) throw new Error('Title and body required');
  threads.unshift(thread);
  saveThreads(threads);
  return { thread: enrichThread(thread, getCategoryMap()), user };
}

function createReply(session, threadId, body) {
  const user = getOrCreateUser(session);
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === threadId && !t.deleted);
  if (idx < 0) throw new Error('Thread not found');
  if (threads[idx].locked) throw new Error('Thread is locked');
  const text = String(body || '').trim();
  if (!text) throw new Error('Reply body required');
  const posts = loadPosts();
  const post = {
    id: newId('pst'),
    threadId,
    authorId: user.id,
    authorEmail: user.email,
    body: text,
    flagged: false,
    deleted: false,
    createdAt: nowIso()
  };
  posts.push(post);
  savePosts(posts);
  threads[idx].replyCount = (threads[idx].replyCount || 0) + 1;
  threads[idx].lastActivityAt = nowIso();
  saveThreads(threads);
  const badge = badgeForUser(user);
  return {
    post: {
      ...post,
      author: {
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        tier: user.tier,
        isFounding: user.isFounding,
        joinDate: user.joinDate
      },
      badge: badge.badge,
      badgeClass: badge.badgeClass
    },
    thread: threads[idx]
  };
}

function toggleFollow(email, threadId) {
  const follows = loadFollows();
  const key = `${email}:${threadId}`;
  const idx = follows.findIndex((f) => f.key === key);
  if (idx >= 0) {
    follows.splice(idx, 1);
    saveFollows(follows);
    return { following: false };
  }
  follows.push({ key, email, threadId, createdAt: nowIso() });
  saveFollows(follows);
  return { following: true };
}

function getFollowedThreadIds(email) {
  return loadFollows().filter((f) => f.email === email).map((f) => f.threadId);
}

function getPulseStats() {
  const threads = loadThreads().filter((t) => !t.deleted);
  const posts = loadPosts().filter((p) => !p.deleted);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const repliesToday = posts.filter((p) => new Date(p.createdAt).getTime() > since).length;
  const trending = threads.filter((t) => trendingScore(t) > 5).length;
  const pinned = threads.filter((t) => t.pinned).length;
  const liveRooms = loadLiveRooms().filter((r) => r.status === 'live').length;
  return { repliesToday, trending, pinned, liveRooms };
}

function getLiveRooms() {
  const now = Date.now();
  return loadLiveRooms()
    .filter((r) => !r.deleted)
    .map((r) => {
      let status = r.status;
      if (status === 'upcoming' && r.startsAt && new Date(r.startsAt).getTime() <= now) {
        status = 'live';
      }
      if (r.endsAt && new Date(r.endsAt).getTime() < now) status = 'closed';
      return { ...r, status };
    })
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

function getLiveRoomMessages(roomId, since) {
  let messages = loadLiveMessages().filter((m) => m.roomId === roomId && !m.deleted);
  if (since) {
    const ts = new Date(since).getTime();
    messages = messages.filter((m) => new Date(m.createdAt).getTime() > ts);
  }
  return messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-100);
}

function postLiveMessage(session, roomId, body) {
  const user = getOrCreateUser(session);
  const rooms = loadLiveRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('Live room not found');
  const text = String(body || '').trim();
  if (!text) throw new Error('Message required');
  const messages = loadLiveMessages();
  const msg = {
    id: newId('lmsg'),
    roomId,
    authorId: user.id,
    authorEmail: user.email,
    displayName: user.displayName,
    body: text,
    deleted: false,
    createdAt: nowIso()
  };
  messages.push(msg);
  saveLiveMessages(messages);
  return msg;
}

function adminPinThread(id, pinned) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  threads[idx].pinned = !!pinned;
  saveThreads(threads);
  return threads[idx];
}

function adminLockThread(id, locked) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  threads[idx].locked = !!locked;
  saveThreads(threads);
  return threads[idx];
}

function adminFeatureThread(id, featured) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  threads[idx].featured = !!featured;
  saveThreads(threads);
  return threads[idx];
}

function adminDeleteThread(id) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  threads[idx].deleted = true;
  saveThreads(threads);
  return threads[idx];
}

function adminDeletePost(id) {
  const posts = loadPosts();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  posts[idx].deleted = true;
  savePosts(posts);
  const threads = loadThreads();
  const tidx = threads.findIndex((t) => t.id === posts[idx].threadId);
  if (tidx >= 0) {
    threads[tidx].replyCount = Math.max(0, (threads[tidx].replyCount || 1) - 1);
    saveThreads(threads);
  }
  return posts[idx];
}

function flagPost(session, postId, reason) {
  const flags = loadFlags();
  const flag = {
    id: newId('flg'),
    postId,
    threadId: null,
    reason: reason || 'review',
    reporterEmail: session.email,
    status: 'open',
    createdAt: nowIso()
  };
  const posts = loadPosts();
  const post = posts.find((p) => p.id === postId);
  if (post) {
    flag.threadId = post.threadId;
    post.flagged = true;
    savePosts(posts);
  }
  flags.unshift(flag);
  saveFlags(flags);
  return flag;
}

function getOpenFlags() {
  return loadFlags().filter((f) => f.status === 'open');
}

function resolveFlag(id, status) {
  const flags = loadFlags();
  const idx = flags.findIndex((f) => f.id === id);
  if (idx < 0) return null;
  flags[idx].status = status || 'resolved';
  flags[idx].resolvedAt = nowIso();
  saveFlags(flags);
  return flags[idx];
}

function adminUpdateCategory(id, patch) {
  const cats = ensureCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  if (patch.name) cats[idx].name = String(patch.name).trim();
  if (patch.badgeLabel) cats[idx].badgeLabel = String(patch.badgeLabel).trim();
  if (patch.sortOrder != null) cats[idx].sortOrder = parseInt(patch.sortOrder, 10) || cats[idx].sortOrder;
  writeJson(CATEGORIES_PATH, cats);
  return cats[idx];
}

function isSeeded() {
  return loadThreads().length > 0;
}

module.exports = {
  DATA_DIR,
  TIER_BADGE,
  trendingScore,
  ensureCategories,
  getOrCreateUser,
  getThreads,
  getThreadById,
  createThread,
  createReply,
  toggleFollow,
  getFollowedThreadIds,
  getPulseStats,
  getLiveRooms,
  getLiveRoomMessages,
  postLiveMessage,
  adminPinThread,
  adminLockThread,
  adminFeatureThread,
  adminDeleteThread,
  adminDeletePost,
  flagPost,
  getOpenFlags,
  resolveFlag,
  adminUpdateCategory,
  isSeeded,
  loadThreads,
  saveThreads,
  loadPosts,
  loadUsers,
  loadLiveRooms,
  defaultCategories
};
