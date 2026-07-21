#!/usr/bin/env node
/**
 * Bake Community hub seed so /vault/community/ never cold-loads into a spinner.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/community-hub-seed.json');
const API = process.env.COMMUNITY_SEED_API || 'https://gatorvault-api.onrender.com';

function fetchJson(url, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function localCategories() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'server/data/community/categories.json'), 'utf8'));
  } catch { return []; }
}

function retainPrevious() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}

function slimThread(t) {
  if (!t || !t.id) return null;
  return {
    id: t.id,
    title: t.title || 'Thread',
    body: String(t.body || '').slice(0, 280),
    categorySlug: t.categorySlug || (t.category && t.category.slug) || 'locker',
    categoryLabel: t.categoryLabel || (t.category && t.category.name) || '',
    authorDisplay: t.authorDisplay || (t.author && t.author.displayName) || 'Member',
    replyCount: t.replyCount || 0,
    viewCount: t.viewCount || 0,
    pinned: Boolean(t.pinned),
    featured: Boolean(t.featured),
    createdAt: t.createdAt || null,
    lastActivityAt: t.lastActivityAt || null,
  };
}

/** Curated first-paint conversations when live UGC is empty. */
function foundingThreads(nowIso) {
  return [
    {
      id: 'seed_founding_board_priority',
      title: 'Who is Florida’s biggest 2027 board priority right now?',
      body: 'Looking at the battle board — which target feels like the program’s true #1, and what would move the needle this month?',
      categorySlug: 'war',
      categoryLabel: 'War Room',
      authorDisplay: 'GatorVault Staff',
      replyCount: 0,
      viewCount: 0,
      pinned: true,
      featured: true,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_portal_watch',
      title: 'Portal watch: which rooms need help before fall camp?',
      body: 'Depth chart first — where does Florida still feel thin, and which portal profiles actually fit the scheme?',
      categorySlug: 'locker',
      categoryLabel: 'Locker Room',
      authorDisplay: 'Insider Desk',
      replyCount: 0,
      viewCount: 0,
      pinned: false,
      featured: true,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_film_clip',
      title: 'Film Room: one clip that changed your mind on a 2027 target',
      body: 'Drop the prospect and what you saw — first step, frame, ball skills, or competitive toughness.',
      categorySlug: 'film',
      categoryLabel: 'Film Room',
      authorDisplay: 'GatorVault Staff',
      replyCount: 0,
      viewCount: 0,
      pinned: false,
      featured: true,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_nil_pulse',
      title: 'NIL pulse: what are fans seeing in the market this week?',
      body: 'Keep it factual — name the market signal and how it intersects Florida’s board or roster.',
      categorySlug: 'war',
      categoryLabel: 'War Room',
      authorDisplay: 'Insider Desk',
      replyCount: 0,
      viewCount: 0,
      pinned: false,
      featured: false,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_gameweek',
      title: 'Game Week open thread — drop your keys before kickoff',
      body: 'Matchup keys, depth chart notes, and recruiting visitors. Keep it sharp and on Florida.',
      categorySlug: 'locker',
      categoryLabel: 'Locker Room',
      authorDisplay: 'GatorVault Staff',
      replyCount: 0,
      viewCount: 0,
      pinned: true,
      featured: false,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_welcome',
      title: 'Founding members: introduce yourself and what you track',
      body: 'Recruiting, film, NIL, game week — tell the room what you follow so staff can shape weekly threads.',
      categorySlug: 'founding',
      categoryLabel: 'Founding',
      authorDisplay: 'GatorVault Staff',
      replyCount: 0,
      viewCount: 0,
      pinned: false,
      featured: true,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_closing_class',
      title: 'Closing Class pulse: which 2027 board name feels hottest this week?',
      body: 'RPM, visits, or crystal-ball chatter — name the prospect and the signal. Keep it board-real, not rumor spam.',
      categorySlug: 'war',
      categoryLabel: 'War Room',
      authorDisplay: 'Insider Desk',
      replyCount: 0,
      viewCount: 0,
      pinned: false,
      featured: true,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
    {
      id: 'seed_founding_staff_scheme',
      title: 'Scheme talk: what should Florida emphasize on defense in year one?',
      body: 'Front structure, coverage identity, or personnel fits — drop one concrete schematic take for the room.',
      categorySlug: 'film',
      categoryLabel: 'Film Room',
      authorDisplay: 'GatorVault Staff',
      replyCount: 0,
      viewCount: 0,
      pinned: false,
      featured: false,
      createdAt: nowIso,
      lastActivityAt: nowIso,
    },
  ];
}

function foundingRooms(nowIso) {
  return [
    {
      id: 'seed_room_gameweek',
      title: 'Game Week Open Thread',
      description: 'Live reaction room every Saturday — keys, visitors, and board chatter.',
      scheduledAt: nowIso,
      status: 'scheduled',
    },
    {
      id: 'seed_room_recruiting_qa',
      title: 'Recruiting Q&A with Staff',
      description: 'Ask board and portal questions — staff answers weekly.',
      scheduledAt: nowIso,
      status: 'scheduled',
    },
  ];
}

async function main() {
  let categories = [];
  let threads = [];
  let pulse = {};
  let rooms = [];
  let source = 'local-fallback';
  const nowIso = new Date().toISOString();

  for (let i = 0; i < 3; i += 1) {
    try {
      const [cats, thr, pul, rms] = await Promise.all([
        fetchJson(API + '/api/community/categories'),
        fetchJson(API + '/api/community/threads?sort=trending&limit=24'),
        fetchJson(API + '/api/community/pulse'),
        fetchJson(API + '/api/community/live-rooms'),
      ]);
      categories = cats.categories || [];
      threads = (thr.threads || []).map(slimThread).filter(Boolean);
      pulse = pul.pulse || {};
      rooms = rms.rooms || [];
      source = 'prod-api';
      break;
    } catch (err) {
      console.warn('[generate-community-hub-seed] fetch failed:', err.message);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }

  if (!categories.length) categories = localCategories();
  const prev = retainPrevious();
  if (!categories.length && prev && prev.categories && prev.categories.length) {
    categories = prev.categories;
    if (!threads.length) threads = prev.threads || [];
    if (!rooms.length) rooms = prev.rooms || [];
    if (!pulse || !Object.keys(pulse).length) pulse = prev.pulse || {};
    source = threads.length ? 'retained-previous' : source;
  }

  if (!categories.length) {
    categories = [
      { id: 'cat_film', slug: 'film', name: 'Film Room', badgeLabel: 'FILM ROOM', badgeClass: 'tier-film', sortOrder: 1 },
      { id: 'cat_locker', slug: 'locker', name: 'Locker Room', badgeLabel: 'LOCKER ROOM', badgeClass: 'tier-locker', sortOrder: 2 },
      { id: 'cat_war', slug: 'war', name: 'War Room', badgeLabel: 'WAR ROOM', badgeClass: 'tier-war', sortOrder: 3 },
      { id: 'cat_founding', slug: 'founding', name: 'Founding', badgeLabel: 'FOUNDING', badgeClass: 'tier-founding', sortOrder: 4 },
    ];
  }

  // Empty live UGC still gets elite first paint from founding conversations.
  if (!threads.length) {
    threads = foundingThreads(nowIso);
    if (source === 'prod-api') source = 'prod-api+founding';
    else source = 'founding-seed';
  }
  if (!rooms.length) rooms = foundingRooms(nowIso);

  if (!pulse || !Object.keys(pulse).length || (pulse.trending == null && pulse.repliesToday == null)) {
    pulse = {
      repliesToday: pulse.repliesToday ?? 0,
      trending: Math.max(pulse.trending || 0, threads.filter((t) => t.featured || t.pinned).length),
      pinned: threads.filter((t) => t.pinned).length,
      liveRooms: rooms.length,
      threadCount: threads.length,
      postCount: pulse.postCount || 0,
      activeToday: pulse.activeToday || 0,
    };
  }

  const seed = { generatedAt: nowIso, source, categories, threads, pulse, rooms };
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log('[generate-community-hub-seed] wrote', OUT, 'source=', source, 'cats=', categories.length, 'threads=', threads.length);
}

main().catch((err) => { console.error('[generate-community-hub-seed] FATAL', err); process.exit(1); });
