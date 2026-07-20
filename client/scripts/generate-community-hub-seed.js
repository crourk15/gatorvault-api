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

async function main() {
  let categories = [];
  let threads = [];
  let pulse = {};
  let rooms = [];
  let source = 'local-fallback';

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
    threads = prev.threads || [];
    pulse = prev.pulse || {};
    rooms = prev.rooms || [];
    source = 'retained-previous';
  }

  if (!categories.length) {
    categories = [
      { id: 'cat_film', slug: 'film', name: 'Film Room' },
      { id: 'cat_locker', slug: 'locker', name: 'Locker Room' },
      { id: 'cat_war', slug: 'war', name: 'War Room' },
    ];
  }
  if (!pulse || !Object.keys(pulse).length) {
    pulse = { threadCount: threads.length, postCount: 0, activeToday: 0, trending: threads.length };
  }

  const seed = { generatedAt: new Date().toISOString(), source, categories, threads, pulse, rooms };
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log('[generate-community-hub-seed] wrote', OUT, 'source=', source, 'cats=', categories.length, 'threads=', threads.length);
}

main().catch((err) => { console.error('[generate-community-hub-seed] FATAL', err); process.exit(1); });
