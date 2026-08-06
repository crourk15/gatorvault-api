#!/usr/bin/env node
/**
 * Bake Film Room catalog seed so /vault/film-room/ never sticks on "Loading film catalog…".
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/film-room-hub-seed.json');
const API = process.env.FILM_SEED_API || 'https://gatorvault-api.onrender.com';

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

/** Coach sit-downs / podcast eps — not tape. Keep "| The Gator Nation Football Podcast" film reviews. */
function isFilmBreakdownEligibleTitle(title) {
  const t = String(title || '');
  if (!t) return true;
  const filmSignal =
    /\b((?:quick\s+)?film\s+review|film\s+breakdown|film\s+study|film\s+analysis)\b/i.test(t);
  const podcastConvo = /\b(podcast\s*episode|talking\s*ball|sit[\s-]?down|q\s*&\s*a)\b/i.test(t);
  if (podcastConvo && !filmSignal) return false;
  return true;
}

function slimItem(item) {
  if (!item || !(item.id || item.title)) return null;
  if (!isFilmBreakdownEligibleTitle(item.title)) return null;
  return {
    id: item.id || item.slug || item.youtubeId,
    slug: item.slug,
    title: String(item.title || '').trim(),
    dek: item.dek || undefined,
    category: item.category,
    filmHub: item.filmHub || item.category || 'Film Breakdown',
    source: item.source,
    sourceUrl: item.sourceUrl || item.videoUrl || undefined,
    locked: Boolean(item.locked),
    season: item.season,
    duration: item.duration,
    youtubeId: item.youtubeId || null,
    embedUrl: item.embedUrl || null,
    videoUrl: item.videoUrl || null,
    knowledgeEngine: Boolean(item.knowledgeEngine),
    gameLine: item.gameLine,
    publishedAt: item.publishedAt || null,
    lastVerified: item.lastVerified || null,
    noVideo: Boolean(item.noVideo),
  };
}

function fromLocalCache() {
  const cachePath = path.join(ROOT, 'server/data/film-room/cache.json');
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const auto = cache.auto || {};
  const rows = [];
  for (const key of Object.keys(auto)) {
    const list = Array.isArray(auto[key]) ? auto[key] : [];
    for (const item of list) {
      const filmHub =
        key === 'pressers'
          ? 'UF Press Conferences'
          : key === 'gnfp'
            ? 'GNFP Film Review'
            : (item.category || 'Film Breakdown');
      rows.push(slimItem({
        ...item,
        filmHub,
      }));
    }
  }
  return rows.filter(Boolean).slice(0, 40);
}

function retainPrevious() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}

async function main() {
  let items = [];
  let categories = [];
  let source = 'local-cache';

  for (let i = 0; i < 3; i += 1) {
    try {
      const data = await fetchJson(API + '/api/film-room/catalog');
      items = (data.items || []).map(slimItem).filter(Boolean).slice(0, 40);
      categories = data.categories || [];
      if (items.length) { source = 'prod-api'; break; }
    } catch (err) {
      console.warn('[generate-film-room-hub-seed] fetch failed:', err.message);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }

  if (!items.length) {
    try {
      items = fromLocalCache();
      source = 'local-cache';
    } catch (err) {
      console.warn('[generate-film-room-hub-seed] local cache failed:', err.message);
    }
  }

  const prev = retainPrevious();
  if (!items.length && prev?.items?.length) {
    items = prev.items;
    categories = prev.categories || [];
    source = 'retained-previous';
  }

  if (!items.length) throw new Error('Film Room seed empty');

  const seed = {
    generatedAt: new Date().toISOString(),
    source,
    categories,
    items,
  };
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log('[generate-film-room-hub-seed] wrote', OUT, 'source=', source, 'items=', items.length);
}

main().catch((err) => { console.error('[generate-film-room-hub-seed] FATAL', err); process.exit(1); });
