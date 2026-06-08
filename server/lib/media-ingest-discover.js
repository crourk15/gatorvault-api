const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');
const store = require('./media-ingest-store');

const BLOCKED_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

function isBlockedUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED_HOSTS.some((b) => host === b || host.endsWith('.' + b));
  } catch {
    return false;
  }
}

function readSidecarMeta(mp4Path) {
  const metaPath = mp4Path.replace(/\.mp4$/i, '.meta.json');
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return {};
  }
}

function titleFromFilename(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function discoverFromInbox(source) {
  const inboxDir = store.resolveServerPath(source.inboxDir || `media/ingest/inbox/${source.kind}s`);
  if (!fs.existsSync(inboxDir)) return [];

  const items = [];
  fs.readdirSync(inboxDir)
    .filter((f) => f.toLowerCase().endsWith('.mp4'))
    .forEach((file) => {
      const localPath = path.join(inboxDir, file);
      const id = store.hashId(`inbox:${source.id}:${localPath}:${fs.statSync(localPath).mtimeMs}`);
      if (store.isSeen(id)) return;

      const meta = readSidecarMeta(localPath);
      items.push({
        id,
        kind: source.kind,
        sourceId: source.id,
        sourceType: 'inbox',
        localPath,
        title: meta.title || titleFromFilename(file),
        dek: meta.dek || meta.summary || '',
        gameLine: meta.gameLine || meta.game || '',
        category: meta.category || source.category || (source.kind === 'interview' ? 'Interview' : 'Highlight'),
        season: meta.season || String(new Date().getFullYear()),
        playerSlugs: meta.playerSlugs || (meta.playerSlug ? [meta.playerSlug] : []),
        gameSlug: meta.gameSlug || null,
        featured: !!meta.featured,
        durationSec: source.durationSec,
        skipIntroSec: source.skipIntroSec,
        skipOutroSec: source.skipOutroSec,
        discoveredAt: new Date().toISOString(),
        status: 'pending'
      });
    });

  return items;
}

async function discoverFromRss(source) {
  if (!source.url) return [];
  const res = await fetch(source.url, { timeout: 30000 });
  if (!res.ok) throw new Error(`RSS fetch failed HTTP ${res.status}`);
  const xml = await res.text();
  const rssItems = parseRssItems(xml, 25);
  const items = [];

  for (const row of rssItems) {
    if (!row.link || isBlockedUrl(row.link)) continue;
    const id = store.hashId(`rss:${source.id}:${row.id || row.link}`);
    if (store.isSeen(id)) continue;

    items.push({
      id,
      kind: source.kind,
      sourceId: source.id,
      sourceType: 'rss',
      sourceUrl: row.link,
      title: row.title,
      dek: row.summary,
      gameLine: '',
      category: source.category || 'Official Highlight',
      season: String(new Date().getFullYear()),
      playerSlugs: [],
      gameSlug: null,
      featured: false,
      durationSec: source.durationSec,
      skipIntroSec: source.skipIntroSec ?? 1.5,
      skipOutroSec: source.skipOutroSec ?? 1.5,
      discoveredAt: new Date().toISOString(),
      status: 'pending'
    });
  }

  return items;
}

async function discoverFromUrlList(source) {
  const urls = source.urls || [];
  const items = [];
  for (const url of urls) {
    if (!url || isBlockedUrl(url)) continue;
    const id = store.hashId(`url:${source.id}:${url}`);
    if (store.isSeen(id)) continue;
    items.push({
      id,
      kind: source.kind,
      sourceId: source.id,
      sourceType: 'url_list',
      sourceUrl: url,
      title: source.title || 'GatorVault Clip',
      dek: source.dek || '',
      gameLine: source.gameLine || '',
      category: source.category || 'Interview',
      season: String(new Date().getFullYear()),
      playerSlugs: source.playerSlugs || [],
      gameSlug: source.gameSlug || null,
      featured: !!source.featured,
      durationSec: source.durationSec,
      skipIntroSec: source.skipIntroSec ?? 2,
      skipOutroSec: source.skipOutroSec ?? 2,
      discoveredAt: new Date().toISOString(),
      status: 'pending'
    });
  }
  return items;
}

function xAuthHeaders() {
  const token = (process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || '').trim();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

async function discoverFromXTimeline(source) {
  const headers = xAuthHeaders();
  if (!headers) throw new Error('X_BEARER_TOKEN required for x_timeline sources');

  const handle = String(source.handle || '').replace(/^@/, '');
  const userRes = await fetch(`https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}`, {
    headers
  });
  if (!userRes.ok) throw new Error(`X user lookup failed HTTP ${userRes.status}`);
  const userJson = await userRes.json();
  const userId = userJson?.data?.id;
  if (!userId) return [];

  const params = new URLSearchParams({
    max_results: '10',
    'tweet.fields': 'created_at,attachments',
    expansions: 'attachments.media_keys',
    'media.fields': 'url,preview_image_url,type,duration_ms,variants'
  });
  const tlRes = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?${params}`, { headers });
  if (!tlRes.ok) throw new Error(`X timeline failed HTTP ${tlRes.status}`);
  const tl = await tlRes.json();
  const mediaMap = {};
  (tl.includes?.media || []).forEach((m) => {
    mediaMap[m.media_key] = m;
  });

  const items = [];
  for (const tweet of tl.data || []) {
    const keys = tweet.attachments?.media_keys || [];
    for (const key of keys) {
      const media = mediaMap[key];
      if (!media || media.type !== 'video') continue;
      const mp4 =
        (media.variants || [])
          .filter((v) => v.content_type === 'video/mp4')
          .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0]?.url || media.url;
      if (!mp4 || isBlockedUrl(mp4)) continue;

      const id = store.hashId(`x:${source.id}:${tweet.id}:${key}`);
      if (store.isSeen(id)) continue;

      items.push({
        id,
        kind: source.kind,
        sourceId: source.id,
        sourceType: 'x_timeline',
        sourceUrl: mp4,
        title: `${handle} clip`,
        dek: tweet.text?.slice(0, 280) || '',
        gameLine: '',
        category: source.category || 'Social Clip',
        season: String(new Date().getFullYear()),
        playerSlugs: [],
        gameSlug: null,
        featured: false,
        durationSec: source.durationSec,
        skipIntroSec: source.skipIntroSec ?? 0.5,
        skipOutroSec: source.skipOutroSec ?? 0.5,
        discoveredAt: new Date().toISOString(),
        status: 'pending'
      });
    }
  }

  return items;
}

async function discoverAll() {
  const sources = store.loadSources();
  const discovered = [];
  const errors = [];

  for (const source of sources) {
    try {
      let batch = [];
      if (source.type === 'inbox') batch = discoverFromInbox(source);
      else if (source.type === 'rss') batch = await discoverFromRss(source);
      else if (source.type === 'url_list') batch = await discoverFromUrlList(source);
      else if (source.type === 'x_timeline') batch = await discoverFromXTimeline(source);
      else errors.push({ sourceId: source.id, error: `Unknown source type: ${source.type}` });

      batch.forEach((item) => {
        store.upsertQueueItem(item);
        discovered.push(item);
      });
    } catch (err) {
      errors.push({ sourceId: source.id, error: err.message });
      store.pushLog({ level: 'error', stage: 'discover', sourceId: source.id, message: err.message });
    }
  }

  return { discovered, errors };
}

module.exports = {
  discoverAll,
  discoverFromInbox,
  discoverFromRss,
  discoverFromUrlList,
  discoverFromXTimeline,
  isBlockedUrl
};
