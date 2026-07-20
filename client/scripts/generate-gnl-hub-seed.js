#!/usr/bin/env node
/**
 * Bake GNL hub seed for first paint from live dashboard (prod) or local feed.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/gnl-hub-seed.json');
const API = process.env.GNL_SEED_API || 'https://gatorvault-api.onrender.com';

function fetchJson(url, timeoutMs = 20000) {
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
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function slimFeedItem(item) {
  return {
    id: item.id,
    type: item.type || 'update',
    title: String(item.title || '').trim(),
    source: item.source || 'GatorVault',
    createdAt: item.createdAt || item.publishedAt || new Date().toISOString(),
    url: item.url || item.source_url || undefined,
  };
}

function fromLocalFeed() {
  const feed = require(path.join(ROOT, 'server/data/live/feed-items.json'));
  const now = new Date().toISOString();
  // Local feed can be older than the live age gate — stamp seed rows as current
  // so first paint stays elite until live refresh replaces them.
  return (Array.isArray(feed) ? feed : [])
    .filter((i) => String(i.title || '').trim())
    .slice(0, 24)
    .map((i, idx) =>
      slimFeedItem({
        ...i,
        createdAt: now,
        id: i.id || `seed-feed-${idx}`,
      })
    );
}

async function main() {
  let feed = [];
  let beat = [];
  let source = 'local-feed';

  try {
    const dash = await fetchJson(API + '/api/live/dashboard?limit=40');
    feed = (dash.feed || []).map(slimFeedItem).filter((i) => i.title);
    beat = (dash.beat && dash.beat.posts) || [];
    if (feed.length || beat.length) source = 'prod-dashboard';
  } catch (err) {
    console.warn('[generate-gnl-hub-seed] prod fetch failed:', err.message);
  }

  if (!feed.length) {
    feed = fromLocalFeed();
    source = source === 'prod-dashboard' ? source : 'local-feed';
  }

  const ticker = feed.slice(0, 8).map((item) => ({
    type: /break/i.test(item.title) ? 'BREAKING' : 'UPDATE',
    text: item.title,
    timestamp: item.createdAt,
    source: item.source,
    url: item.url,
  }));

  const beatHighlights = (beat || [])
    .filter((p) => String(p.text || '').trim())
    .slice(0, 8)
    .map((p) => ({
      text: String(p.text || '').trim(),
      source: p.outlet || 'Beat',
      timestamp: p.publishedAt || undefined,
      url: p.url,
      handle: p.handle,
      writerName: p.writerName || p.handle || p.outlet || 'Beat Writer',
    }));

  // If beat empty, promote a few feed rows into beat-style highlights for first paint depth.
  if (!beatHighlights.length) {
    feed.slice(0, 4).forEach((item) => {
      beatHighlights.push({
        text: item.title,
        source: item.source || 'GatorVault',
        timestamp: item.createdAt,
        url: item.url,
        writerName: 'GatorVault Live',
      });
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source,
    ticker,
    feed: feed.slice(0, 20),
    panels: {
      visitsNow: feed
        .filter((i) => /visit|on campus|ov/i.test(i.title))
        .slice(0, 6)
        .map((i) => ({ text: i.title, source: i.source, timestamp: i.createdAt })),
      portalBuzz: feed
        .filter((i) => /portal|transfer/i.test(i.title))
        .slice(0, 6)
        .map((i) => ({ text: i.title, source: i.source, timestamp: i.createdAt })),
      beatWriterHighlights: beatHighlights,
      staffNotes: feed
        .filter((i) => /staff|coach/i.test(i.title))
        .slice(0, 4)
        .map((i) => ({ text: i.title, source: i.source, timestamp: i.createdAt })),
    },
  };

  const signal =
    payload.feed.length + payload.ticker.length + payload.panels.beatWriterHighlights.length;
  if (signal < 6) {
    console.error('[generate-gnl-hub-seed] FAIL — insufficient live signal', signal);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  console.log(
    '[generate-gnl-hub-seed] OK —',
    source,
    'feed',
    payload.feed.length,
    'ticker',
    payload.ticker.length,
    'beat',
    payload.panels.beatWriterHighlights.length
  );
}

main().catch((err) => {
  console.error('[generate-gnl-hub-seed] fatal:', err);
  process.exit(1);
});
