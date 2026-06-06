/**
 * DEV ONLY — seeds demo community threads. Not used in production.
 * Run locally: COMMUNITY_SEED_ENABLED=true node scripts/seed-community.js
 * Or set COMMUNITY_SEED_ENABLED=true on the server (not recommended for live).
 */
const path = require('path');
const store = require('../lib/community-store');

const DATA_DIR = store.DATA_DIR;

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

function seed() {
  if (store.isSeeded()) {
    console.log('Community already seeded — skipping.');
    return;
  }

  const fs = require('fs');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const categories = store.defaultCategories();
  fs.writeFileSync(path.join(DATA_DIR, 'categories.json'), JSON.stringify(categories, null, 2));

  const users = [
    {
      id: 'usr_seed_film',
      email: 'filmdesk@gatorvault.com',
      displayName: 'GatorVault Film Desk',
      avatarUrl: null,
      tier: 'film',
      isFounding: false,
      joinDate: hoursAgo(720),
      createdAt: hoursAgo(720)
    },
    {
      id: 'usr_seed_locker',
      email: 'locker@gatorvault.com',
      displayName: 'SwampInsider',
      avatarUrl: null,
      tier: 'locker',
      isFounding: false,
      joinDate: hoursAgo(500),
      createdAt: hoursAgo(500)
    },
    {
      id: 'usr_seed_war',
      email: 'warroom@gatorvault.com',
      displayName: 'GatorAnalytics',
      avatarUrl: null,
      tier: 'war',
      isFounding: false,
      joinDate: hoursAgo(400),
      createdAt: hoursAgo(400)
    },
    {
      id: 'usr_seed_founding',
      email: 'charles@gatorvault.com',
      displayName: 'Charles from Bartow',
      avatarUrl: null,
      tier: 'film',
      isFounding: true,
      joinDate: hoursAgo(200),
      createdAt: hoursAgo(200)
    }
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));

  const threads = [
    {
      id: 'thr_qb_battle',
      title: '🏈 Who wins the QB battle — Jones Jr. or Philo?',
      body: 'Both had strong spring moments. Who do you have winning the job before FAU?',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: 'usr_seed_locker',
      authorEmail: 'locker@gatorvault.com',
      pinned: true,
      locked: false,
      featured: true,
      replyCount: 4,
      viewCount: 312,
      lastActivityAt: hoursAgo(0.33),
      createdAt: hoursAgo(48),
      deleted: false
    },
    {
      id: 'thr_cb_duo',
      title: '📋 McClain & Hanks — can UF field a top SEC CB duo?',
      body: 'McClain enrolled last portal cycle. How does this pair stack up in the SEC?',
      categoryId: 'cat_film',
      categorySlug: 'film',
      authorId: 'usr_seed_film',
      authorEmail: 'filmdesk@gatorvault.com',
      pinned: true,
      locked: false,
      featured: false,
      replyCount: 2,
      viewCount: 198,
      lastActivityAt: hoursAgo(2),
      createdAt: hoursAgo(72),
      deleted: false
    },
    {
      id: 'thr_ol_questions',
      title: '💪 OL questions — can five new starters hold up?',
      body: 'Moore and Boyer look solid but depth is thin. Biggest concern on the line?',
      categoryId: 'cat_film',
      categorySlug: 'film',
      authorId: 'usr_seed_film',
      authorEmail: 'filmdesk@gatorvault.com',
      pinned: false,
      locked: false,
      featured: false,
      replyCount: 1,
      viewCount: 87,
      lastActivityAt: hoursAgo(4),
      createdAt: hoursAgo(96),
      deleted: false
    },
    {
      id: 'thr_schedule',
      title: '🎯 2026 schedule — what is the make-or-break stretch?',
      body: 'Texas, Georgia, Auburn, LSU — which three games define the season?',
      categoryId: 'cat_locker',
      categorySlug: 'locker',
      authorId: 'usr_seed_locker',
      authorEmail: 'locker@gatorvault.com',
      pinned: false,
      locked: false,
      featured: false,
      replyCount: 1,
      viewCount: 64,
      lastActivityAt: hoursAgo(5),
      createdAt: hoursAgo(120),
      deleted: false
    },
    {
      id: 'thr_portal_recap',
      title: '🔄 Portal recap — A or B offseason overall?',
      body: 'Singleton, Philo, Dippre, and the OL haul — grade the portal class.',
      categoryId: 'cat_war',
      categorySlug: 'war',
      authorId: 'usr_seed_war',
      authorEmail: 'warroom@gatorvault.com',
      pinned: false,
      locked: false,
      featured: false,
      replyCount: 1,
      viewCount: 142,
      lastActivityAt: hoursAgo(6),
      createdAt: hoursAgo(144),
      deleted: false
    },
    {
      id: 'thr_poll_wr_ol',
      title: '📊 Member poll — Should UF prioritize WR or OL in 2027?',
      body: 'Hiller anchors the OL class but WR depth is a need. Where do you lean?',
      categoryId: 'cat_founding',
      categorySlug: 'founding',
      authorId: 'usr_seed_founding',
      authorEmail: 'charles@gatorvault.com',
      pinned: false,
      locked: false,
      featured: false,
      replyCount: 1,
      viewCount: 55,
      lastActivityAt: hoursAgo(0.1),
      createdAt: hoursAgo(12),
      deleted: false
    },
    {
      id: 'thr_welcome',
      title: '👋 Welcome Thread — Introduce yourself!',
      body: 'New to GatorVault? Drop your name, where you are from, and how long you have been a Gator.',
      categoryId: 'cat_founding',
      categorySlug: 'founding',
      authorId: 'usr_seed_founding',
      authorEmail: 'charles@gatorvault.com',
      pinned: false,
      locked: false,
      featured: true,
      replyCount: 1,
      viewCount: 220,
      lastActivityAt: hoursAgo(0.05),
      createdAt: hoursAgo(240),
      deleted: false
    }
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'threads.json'), JSON.stringify(threads, null, 2));

  const posts = [
    { id: 'pst_1', threadId: 'thr_qb_battle', authorId: 'usr_seed_film', authorEmail: 'filmdesk@gatorvault.com', body: 'Philo wins by week 3 if the OL protects him. He has the cleaner pro-style delivery.', flagged: false, deleted: false, createdAt: hoursAgo(2) },
    { id: 'pst_2', threadId: 'thr_qb_battle', authorId: 'usr_seed_locker', authorEmail: 'locker@gatorvault.com', body: 'Jones Jr. has the experience edge, especially on the road. That matters in the first three games.', flagged: false, deleted: false, createdAt: hoursAgo(1) },
    { id: 'pst_3', threadId: 'thr_qb_battle', authorId: 'usr_seed_war', authorEmail: 'warroom@gatorvault.com', body: 'They split series time Weeks 1-3, then the starter gets hot. This is the biggest decision of the offseason.', flagged: false, deleted: false, createdAt: hoursAgo(0.75) },
    { id: 'pst_4', threadId: 'thr_qb_battle', authorId: 'usr_seed_founding', authorEmail: 'charles@gatorvault.com', body: 'Was at spring game. Both looked sharp, but the offense still needs faster reads.', flagged: false, deleted: false, createdAt: hoursAgo(0.33) },
    { id: 'pst_5', threadId: 'thr_cb_duo', authorId: 'usr_seed_film', authorEmail: 'filmdesk@gatorvault.com', body: 'McClain enrolled last portal cycle, not this offseason. His return as LCB lets White play more press-man.', flagged: false, deleted: false, createdAt: hoursAgo(3) },
    { id: 'pst_6', threadId: 'thr_cb_duo', authorId: 'usr_seed_war', authorEmail: 'warroom@gatorvault.com', body: 'Top-5 CB duo in the SEC if McClain and Hanks stay healthy.', flagged: false, deleted: false, createdAt: hoursAgo(2) },
    { id: 'pst_7', threadId: 'thr_ol_questions', authorId: 'usr_seed_film', authorEmail: 'filmdesk@gatorvault.com', body: 'Boyer and Moore are plug-and-play, but depth behind them is the real concern.', flagged: false, deleted: false, createdAt: hoursAgo(4) },
    { id: 'pst_8', threadId: 'thr_schedule', authorId: 'usr_seed_locker', authorEmail: 'locker@gatorvault.com', body: 'Oct at Texas then Georgia... brutal. Win those and the season is saved.', flagged: false, deleted: false, createdAt: hoursAgo(5) },
    { id: 'pst_9', threadId: 'thr_portal_recap', authorId: 'usr_seed_war', authorEmail: 'warroom@gatorvault.com', body: 'A- overall. The portal class addressed the biggest weaknesses, but the defense still needs depth.', flagged: false, deleted: false, createdAt: hoursAgo(6) },
    { id: 'pst_10', threadId: 'thr_poll_wr_ol', authorId: 'usr_seed_founding', authorEmail: 'charles@gatorvault.com', body: 'WR is the priority. The offense needs explosive playmakers.', flagged: false, deleted: false, createdAt: hoursAgo(0.1) },
    { id: 'pst_11', threadId: 'thr_welcome', authorId: 'usr_seed_founding', authorEmail: 'charles@gatorvault.com', body: 'Charles from Bartow, FL checking in! Go Gators! 🐊', flagged: false, deleted: false, createdAt: hoursAgo(0.05) }
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'posts.json'), JSON.stringify(posts, null, 2));

  const liveRooms = [
    {
      id: 'room_portal',
      title: 'Portal Watch Room',
      description: 'Live analysis the moment transfer window news breaks.',
      status: 'live',
      startsAt: hoursAgo(1),
      endsAt: null,
      deleted: false,
      createdAt: hoursAgo(168)
    },
    {
      id: 'room_signing',
      title: 'Signing Day Strategy',
      description: 'Preview the 2027 board before national signing day.',
      status: 'upcoming',
      startsAt: new Date('2027-02-01T18:00:00Z').toISOString(),
      endsAt: null,
      deleted: false,
      createdAt: hoursAgo(48)
    },
    {
      id: 'room_gameday',
      title: 'Game Day Locker Room',
      description: 'Opens two hours before kickoff for live game talk and play calls.',
      status: 'upcoming',
      startsAt: new Date('2026-09-05T17:45:00Z').toISOString(),
      endsAt: new Date('2026-09-05T23:00:00Z').toISOString(),
      deleted: false,
      createdAt: hoursAgo(24)
    }
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'live_rooms.json'), JSON.stringify(liveRooms, null, 2));

  const liveMessages = [
    {
      id: 'lmsg_1',
      roomId: 'room_portal',
      authorId: 'usr_seed_war',
      authorEmail: 'warroom@gatorvault.com',
      displayName: 'GatorAnalytics',
      body: 'Watching for any late portal movement before fall camp.',
      deleted: false,
      createdAt: hoursAgo(0.5)
    }
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'live_messages.json'), JSON.stringify(liveMessages, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'flags.json'), '[]');
  fs.writeFileSync(path.join(DATA_DIR, 'follows.json'), '[]');

  console.log(`Seeded ${threads.length} threads, ${posts.length} posts, ${users.length} users, ${liveRooms.length} live rooms.`);
}

seed();
