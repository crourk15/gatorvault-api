const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const {
  normalizeReportReason,
  hasDuplicateOpenFlag,
  flagValidationError,
} = require('./community-flag-utils');

/** Bundled seed lives here; mutable UGC redirects to GV_COMMUNITY_DATA_DIR (/var/data/community). */
const BUNDLE_DATA_DIR = path.join(__dirname, '..', 'data', 'community');
const RENDER_COMMUNITY_DATA_DIR = '/var/data/community';

function resolveCommunityDataDir() {
  const fromEnv = String(process.env.GV_COMMUNITY_DATA_DIR || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_COMMUNITY_DATA_DIR;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_DATA_DIR;
}

const DATA_DIR = resolveCommunityDataDir();

function migrateBundleCommunityIfNeeded() {
  if (DATA_DIR === BUNDLE_DATA_DIR) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const destThreads = path.join(DATA_DIR, 'threads.json');
    if (fs.existsSync(destThreads)) {
      try {
        const existing = JSON.parse(fs.readFileSync(destThreads, 'utf8'));
        if (Array.isArray(existing) && existing.length > 0) return;
      } catch {
        /* continue migrate */
      }
    }
    if (!fs.existsSync(BUNDLE_DATA_DIR)) return;
    for (const file of fs.readdirSync(BUNDLE_DATA_DIR)) {
      if (!file.endsWith('.json')) continue;
      const src = path.join(BUNDLE_DATA_DIR, file);
      const dest = path.join(DATA_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch (err) {
    console.warn('[community-store] durable migrate skipped:', err.message);
  }
}

migrateBundleCommunityIfNeeded();

const USERS_PATH = path.join(DATA_DIR, 'users.json');
const THREADS_PATH = path.join(DATA_DIR, 'threads.json');
const POSTS_PATH = path.join(DATA_DIR, 'posts.json');
const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json');
const LIVE_ROOMS_PATH = path.join(DATA_DIR, 'live_rooms.json');
const LIVE_MESSAGES_PATH = path.join(DATA_DIR, 'live_messages.json');
const FLAGS_PATH = path.join(DATA_DIR, 'flags.json');
const FOLLOWS_PATH = path.join(DATA_DIR, 'follows.json');

const STAFF_USER = {
  id: 'usr_gv_staff',
  email: 'staff@gatorvaultinsider.com',
  displayName: 'GatorVault Staff',
};

/** Honest staff prompts for the daily open thread (real OP text, replyCount starts at 0). */
const DAILY_OPEN_PROMPTS = [
  {
    title: 'Daily open: what moved Florida’s board overnight?',
    body: 'Visits, RPM, portal chatter, or scheme notes — drop one concrete signal and why it matters today.',
    categorySlug: 'war',
  },
  {
    title: 'Daily open: depth chart question you want answered',
    body: 'Name the room and the uncertainty. Staff and members — keep it roster-real.',
    categorySlug: 'locker',
  },
  {
    title: 'Daily open: one film trait you’re watching this week',
    body: 'Prospect or roster player — first step, eyes, ball skills, or toughness. Be specific.',
    categorySlug: 'film',
  },
  {
    title: 'Daily open: portal fit you’d prioritize before fall camp',
    body: 'Position, scheme fit, and what Florida already has. No rumor spam.',
    categorySlug: 'locker',
  },
  {
    title: 'Daily open: recruiting visitor or board name heating up',
    body: 'Who’s getting louder — and what’s the public signal (visit, offer, crystal ball)?',
    categorySlug: 'war',
  },
  {
    title: 'Daily open: NIL market signal fans are seeing',
    body: 'Keep it factual — market move and how it intersects Florida’s board or roster.',
    categorySlug: 'war',
  },
  {
    title: 'Daily open: game week keys before Saturday',
    body: 'Matchup keys, depth notes, visitors. Sharp and on Florida.',
    categorySlug: 'locker',
  },
];

const TIER_BADGE = {
  locker: { badge: '🏟️ LOCKER ROOM', badgeClass: 'tier-locker' },
  film: { badge: '🎬 FILM ROOM', badgeClass: 'tier-film' },
  war: { badge: '⚔️ WAR ROOM', badgeClass: 'tier-war' },
  founding: { badge: '🏅 FOUNDING', badgeClass: 'tier-founding' }
};

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!String(raw || '').trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

/** Threads/posts: never treat corrupt JSON as empty (prevents founding wipe). */
function readJsonArrayStrict(filePath) {
  if (!fs.existsSync(filePath)) return { ok: true, missing: true, data: [] };
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!String(raw || '').trim()) return { ok: true, missing: true, data: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { ok: false, missing: false, data: [], error: 'not_array' };
    }
    return { ok: true, missing: false, data: parsed };
  } catch (err) {
    return { ok: false, missing: false, data: [], error: err.message };
  }
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

/** Client bake sometimes used seed_founding_*; server founding IDs are thr_founding_*. */
function resolveThreadId(id) {
  const raw = String(id || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('seed_founding_')) {
    return `thr_founding_${raw.slice('seed_founding_'.length)}`;
  }
  return raw;
}

function todayKeyET() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function dayOfYearET() {
  const key = todayKeyET();
  const [y, m, d] = key.split('-').map(Number);
  const start = Date.UTC(y, 0, 0);
  const now = Date.UTC(y, m - 1, d);
  return Math.floor((now - start) / 86400000);
}

function ensureStaffUser() {
  const users = loadUsers();
  if (users.some((u) => u.id === STAFF_USER.id)) return users.find((u) => u.id === STAFF_USER.id);
  const ts = nowIso();
  const staff = {
    id: STAFF_USER.id,
    email: STAFF_USER.email,
    displayName: STAFF_USER.displayName,
    avatarUrl: null,
    tier: 'film',
    isFounding: true,
    joinDate: ts,
    createdAt: ts,
  };
  users.push(staff);
  saveUsers(users);
  return staff;
}

function staffSession() {
  ensureStaffUser();
  return {
    email: STAFF_USER.email,
    displayName: STAFF_USER.displayName,
  };
}

/**
 * One fresh staff OP per ET calendar day. Does not invent fan replies.
 * Idempotent: returns existing daily thread when already published.
 */
function ensureDailyOpenThread() {
  ensureCategories();
  ensureFoundingSurface();
  ensureStaffUser();
  const today = todayKeyET();
  const threads = loadThreads();
  const existing = threads.find((t) => t.dailyKey === today && !t.deleted);
  if (existing) {
    // Keep today's daily at the top of Jump-in.
    if (!existing.pinned || !existing.featured) {
      existing.pinned = true;
      existing.featured = true;
      saveThreads(threads);
    }
    return { created: false, thread: existing };
  }

  const prompt = DAILY_OPEN_PROMPTS[dayOfYearET() % DAILY_OPEN_PROMPTS.length];
  const cats = ensureCategories();
  const cat = cats.find((c) => c.slug === prompt.categorySlug) || cats[0];
  const ts = nowIso();

  for (const t of threads) {
    if (t.dailyKey && t.dailyKey !== today) {
      t.pinned = false;
    }
  }

  const thread = {
    id: newId('thr_daily'),
    title: prompt.title,
    body: prompt.body,
    categoryId: cat.id,
    categorySlug: cat.slug,
    authorId: STAFF_USER.id,
    authorEmail: STAFF_USER.email,
    pinned: true,
    locked: false,
    featured: true,
    replyCount: 0,
    viewCount: 0,
    lastActivityAt: ts,
    createdAt: ts,
    deleted: false,
    dailyKey: today,
  };
  threads.unshift(thread);
  saveThreads(threads);
  return { created: true, thread };
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

/**
 * When UGC is empty, seed honest staff founding threads (replyCount 0).
 * Does not invent engagement — fans fill the room over time.
 */
function ensureFoundingSurface() {
  ensureCategories();
  const loaded = readJsonArrayStrict(THREADS_PATH);
  if (!loaded.ok) {
    console.error(
      '[community-store] refusing founding reseed — corrupt threads store:',
      loaded.error
    );
    return { seeded: false, corrupt: true, count: 0 };
  }
  const existing = loaded.data.filter((t) => !t.deleted);
  if (existing.length > 0) return { seeded: false, count: existing.length };

  const ts = nowIso();
  const staffId = 'usr_gv_staff';
  const users = loadUsers();
  if (!users.some((u) => u.id === staffId)) {
    users.push({
      id: staffId,
      email: 'staff@gatorvaultinsider.com',
      displayName: 'GatorVault Staff',
      avatarUrl: null,
      tier: 'film',
      isFounding: true,
      joinDate: ts,
      createdAt: ts,
    });
    saveUsers(users);
  }

  const threads = [
    {
      id: 'thr_founding_board_priority',
      title: "Who is Florida's biggest 2027 board priority right now?",
      body: "Looking at the battle board — which target feels like the program's true #1, and what would move the needle this month?",
      categoryId: 'cat_war',
      categorySlug: 'war',
      authorId: staffId,
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: true,
      locked: false,
      featured: true,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: ts,
      createdAt: ts,
      deleted: false,
    },
    {
      id: 'thr_founding_portal_watch',
      title: 'Portal watch: which rooms need help before fall camp?',
      body: 'Depth chart first — where does Florida still feel thin, and which portal profiles actually fit the scheme?',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: staffId,
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      locked: false,
      featured: true,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: ts,
      createdAt: ts,
      deleted: false,
    },
    {
      id: 'thr_founding_film_clip',
      title: 'Film Room: one clip that changed your mind on a 2027 target',
      body: 'Drop the prospect and what you saw — first step, frame, ball skills, or competitive toughness.',
      categoryId: 'cat_film',
      categorySlug: 'film',
      authorId: staffId,
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      locked: false,
      featured: true,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: ts,
      createdAt: ts,
      deleted: false,
    },
    {
      id: 'thr_founding_welcome',
      title: 'Founding members: introduce yourself and what you track',
      body: 'Recruiting, film, NIL, game week — tell the room what you follow so staff can shape weekly threads.',
      categoryId: 'cat_founding',
      categorySlug: 'founding',
      authorId: staffId,
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      locked: false,
      featured: true,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: ts,
      createdAt: ts,
      deleted: false,
    },
    {
      id: 'thr_founding_gameweek',
      title: 'Game Week open thread — drop your keys before kickoff',
      body: 'Matchup keys, depth chart notes, and recruiting visitors. Keep it sharp and on Florida.',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: staffId,
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: true,
      locked: false,
      featured: false,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: ts,
      createdAt: ts,
      deleted: false,
    },
    {
      id: 'thr_founding_nil_pulse',
      title: 'NIL pulse: what are fans seeing in the market this week?',
      body: "Keep it factual — name the market signal and how it intersects Florida's board or roster.",
      categoryId: 'cat_war',
      categorySlug: 'war',
      authorId: staffId,
      authorEmail: 'staff@gatorvaultinsider.com',
      pinned: false,
      locked: false,
      featured: false,
      replyCount: 0,
      viewCount: 0,
      lastActivityAt: ts,
      createdAt: ts,
      deleted: false,
    },
  ];
  saveThreads(threads);

  const rooms = loadLiveRooms();
  if (!rooms.length) {
    writeJson(LIVE_ROOMS_PATH, [
      {
        id: 'room_gameweek',
        title: 'Game Week Open Thread',
        description: 'Live reaction room every Saturday — keys, visitors, and board chatter.',
        scheduledAt: ts,
        status: 'scheduled',
      },
      {
        id: 'room_recruiting_qa',
        title: 'Recruiting Q&A with Staff',
        description: 'Ask board and portal questions — staff answers weekly.',
        scheduledAt: ts,
        status: 'scheduled',
      },
    ]);
  }

  return { seeded: true, count: threads.length };
}

function loadUsers() {
  return readJson(USERS_PATH, []);
}

function saveUsers(users) {
  writeJson(USERS_PATH, users);
}

function loadThreads() {
  const loaded = readJsonArrayStrict(THREADS_PATH);
  if (!loaded.ok) {
    const err = new Error(`Community threads store unreadable: ${loaded.error}`);
    err.code = 'COMMUNITY_STORE_CORRUPT';
    throw err;
  }
  return loaded.data;
}

function saveThreads(threads) {
  writeJson(THREADS_PATH, threads);
}

function loadPosts() {
  const loaded = readJsonArrayStrict(POSTS_PATH);
  if (!loaded.ok) {
    const err = new Error(`Community posts store unreadable: ${loaded.error}`);
    err.code = 'COMMUNITY_STORE_CORRUPT';
    throw err;
  }
  return loaded.data;
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
  } else if (thread.authorId) {
    enriched.author = { displayName: 'Deleted member', avatarUrl: null, tier: null, isFounding: false };
  }
  return enriched;
}

function getThreads({ sort = 'trending', category, limit = 50 } = {}) {
  ensureCategories();
  ensureFoundingSurface();
  ensureDailyOpenThread();
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
  const resolvedId = resolveThreadId(id);
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === resolvedId && !t.deleted);
  if (idx < 0) return null;
  if (incrementView) {
    threads[idx].viewCount = (threads[idx].viewCount || 0) + 1;
    saveThreads(threads);
  }
  const categoryMap = getCategoryMap();
  const posts = loadPosts()
    .filter((p) => p.threadId === resolvedId && !p.deleted)
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
  const resolvedId = resolveThreadId(threadId);
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === resolvedId && !t.deleted);
  if (idx < 0) throw new Error('Thread not found');
  if (threads[idx].locked) throw new Error('Thread is locked');
  const text = String(body || '').trim();
  if (!text) throw new Error('Reply body required');
  const posts = loadPosts();
  const post = {
    id: newId('pst'),
    threadId: resolvedId,
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
  ensureDailyOpenThread();
  const threads = loadThreads().filter((t) => !t.deleted);
  const posts = loadPosts().filter((p) => !p.deleted);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const repliesToday = posts.filter((p) => new Date(p.createdAt).getTime() > since).length;
  // Honest: only threads with real replies count as trending — no recency theater.
  const trending = threads.filter((t) => (t.replyCount || 0) > 0).length;
  const pinned = threads.filter((t) => t.pinned).length;
  const liveRooms = loadLiveRooms().filter((r) => r.status === 'live').length;
  return { repliesToday, trending, pinned, liveRooms };
}

/** Admin: create a real staff OP (PIN-gated). */
function adminCreateStaffThread({ title, body, categorySlug, pinned, featured }) {
  const result = createThread(staffSession(), {
    title,
    body,
    categorySlug: categorySlug || 'locker',
  });
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === result.thread.id);
  if (idx >= 0) {
    threads[idx].pinned = Boolean(pinned);
    threads[idx].featured = Boolean(featured);
    saveThreads(threads);
    result.thread = enrichThread(threads[idx], getCategoryMap());
  }
  return result;
}

/** Admin: post a real staff reply (PIN-gated). */
function adminStaffReply(threadId, body) {
  return createReply(staffSession(), threadId, body);
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
  const normalizedReason = normalizeReportReason(reason);
  if (!normalizedReason) {
    throw flagValidationError('Invalid report reason.', 400);
  }
  if (hasDuplicateOpenFlag(flags, { reporterEmail: session.email, postId })) {
    throw flagValidationError('You already reported this content.', 409);
  }
  const flag = {
    id: newId('flg'),
    postId,
    threadId: null,
    reason: normalizedReason,
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

function flagThread(session, threadId, reason) {
  const flags = loadFlags();
  const normalizedReason = normalizeReportReason(reason);
  if (!normalizedReason) {
    throw flagValidationError('Invalid report reason.', 400);
  }
  if (hasDuplicateOpenFlag(flags, { reporterEmail: session.email, threadId })) {
    throw flagValidationError('You already reported this content.', 409);
  }
  const flag = {
    id: newId('flg'),
    postId: null,
    threadId,
    reason: normalizedReason,
    reporterEmail: session.email,
    status: 'open',
    createdAt: nowIso()
  };
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === threadId && !t.deleted);
  if (idx >= 0) {
    threads[idx].flagged = true;
    saveThreads(threads);
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
  ensureFoundingSurface();
  return loadThreads().length > 0;
}

module.exports = {
  DATA_DIR,
  BUNDLE_DATA_DIR,
  TIER_BADGE,
  trendingScore,
  resolveThreadId,
  ensureCategories,
  ensureFoundingSurface,
  ensureDailyOpenThread,
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
  adminCreateStaffThread,
  adminStaffReply,
  flagPost,
  flagThread,
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
