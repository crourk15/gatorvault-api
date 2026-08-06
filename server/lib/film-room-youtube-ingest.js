/**
 * Auto-ingest Film Room videos from YouTube channel RSS (no API key required).
 * Official Florida Gators football pressers + GNFP film reviews by default.
 */
const fetch = require('node-fetch');
const { loadFilmRoomCache, saveFilmRoomCache } = require('./film-room-cache-store');

const DEFAULT_SOURCES = [
  {
    channelId: 'UC97IlakvONh8RBUODRuk4mA',
    bucket: 'pressers',
    label: 'Florida Gators YouTube',
    kind: 'florida_official',
  },
  // Football program channel — fall camp / Sumrall pressers land here, not athletics.
  {
    channelId: 'UCGy38_kQ5tV_e87Uhs3VCRQ',
    bucket: 'pressers',
    label: 'Florida Gators Football',
    kind: 'gators_football',
  },
  {
    channelId: 'UC4uzOAHPLPqEnNpNmDUP1VA',
    bucket: 'gnfp',
    label: 'GNFP',
    kind: 'gnfp',
  },
];

const NON_FOOTBALL =
  /\b(soccer|softball|baseball|basketball|gymnast|swimming|diving|tennis|golf|volleyball|lacrosse|cross country|track|soccer|wrestling|row(?:ing)?|cheer)\b/i;

const PRESSER_TITLE =
  /\b(press conference|media availability|media day|media days|availability)\b/i;

const FOOTBALL_HINT =
  /\b(football|gators football|spring (?:practice|game)|sumrall|faulkner|napier|sec media|offense|defense|coordinator|head coach|rb\b|wr\b|qb\b|lb\b)\b/i;

/** Real film study — not coach sit-downs / podcast episodes. */
const GNFP_FILM_SIGNAL =
  /\b((?:quick\s+)?film\s+review|film\s+breakdown|film\s+study|film\s+analysis)\b/i;

/** Coach conversations / podcast eps that match "GNFP" but are not tape breakdown. */
const GNFP_PODCAST_CONVO =
  /\b(podcast\s*episode|talking\s*ball|sit[\s-]?down|q\s*&\s*a)\b/i;

function isGnfpFilmBreakdownTitle(title) {
  const t = String(title || '');
  if (!t) return false;
  if (GNFP_PODCAST_CONVO.test(t) && !GNFP_FILM_SIGNAL.test(t)) return false;
  return GNFP_FILM_SIGNAL.test(t);
}

function slugify(title) {
  return String(title || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseSourcesFromEnv() {
  const raw = String(process.env.FILM_ROOM_YOUTUBE_SOURCES || '').trim();
  if (!raw) return DEFAULT_SOURCES.slice();
  // channelId:bucket:label,channelId:bucket:label
  return raw.split(',').map((part) => {
    const [channelId, bucket, label] = part.split(':').map((s) => String(s || '').trim());
    return {
      channelId,
      bucket: bucket === 'gnfp' ? 'gnfp' : 'pressers',
      label: label || channelId,
      kind: bucket === 'gnfp' ? 'gnfp' : 'custom',
    };
  }).filter((s) => s.channelId);
}

function decodeXml(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseRssEntries(xml) {
  const entries = [];
  const chunks = String(xml || '').split('<entry>').slice(1);
  for (const chunk of chunks) {
    const body = chunk.split('</entry>')[0] || '';
    const videoId = (body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = decodeXml((body.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const published = (body.match(/<published>([^<]+)<\/published>/) || [])[1] || null;
    const thumb = (body.match(/url="(https:\/\/i[^"]+hqdefault[^"]*)"/) || body.match(/url="(https:\/\/i[^"]+)"/) || [])[1]
      || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
    if (!videoId || !title) continue;
    entries.push({
      youtubeId: videoId,
      title,
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
      thumbUrl: thumb,
    });
  }
  return entries;
}

async function fetchChannelFeed(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/atom+xml,application/xml,text/xml', 'User-Agent': 'gatorvault-film-room-ingest/1.0' },
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`YouTube RSS HTTP ${res.status} for ${channelId}`);
  const xml = await res.text();
  return parseRssEntries(xml);
}

function shouldKeepEntry(entry, source) {
  const title = entry.title || '';
  if (source.kind === 'gnfp' || source.bucket === 'gnfp') {
    return isGnfpFilmBreakdownTitle(title);
  }
  // Florida official + custom presser sources
  if (NON_FOOTBALL.test(title) && !/football/i.test(title)) return false;
  if (!PRESSER_TITLE.test(title)) return false;
  // Official athletics channel posts every sport — require football hint OR explicit Gators Football pattern
  if (source.kind === 'florida_official') {
    return FOOTBALL_HINT.test(title) || /florida football/i.test(title);
  }
  return true;
}

function toCacheRow(entry, source) {
  const id = `yt_${entry.youtubeId}`;
  const publishedAt = entry.publishedAt || null;
  const year = publishedAt
    ? new Date(publishedAt).getUTCFullYear()
    : new Date().getUTCFullYear();
  return {
    id,
    slug: slugify(entry.title),
    title: entry.title,
    dek: '',
    gameLine: source.bucket === 'gnfp' ? 'GNFP Film Review' : 'Florida Gators Football',
    season: String(Number.isFinite(year) ? year : new Date().getUTCFullYear()),
    category: source.bucket === 'gnfp' ? 'Film Breakdown' : 'Press Conferences',
    duration: 'YouTube',
    thumbUrl: entry.thumbUrl || `https://i.ytimg.com/vi/${entry.youtubeId}/hqdefault.jpg`,
    videoUrl: `https://www.youtube.com/watch?v=${entry.youtubeId}`,
    youtubeId: entry.youtubeId,
    embedUrl: `https://www.youtube.com/embed/${entry.youtubeId}`,
    source: source.label,
    autoUpdate: true,
    mediaReady: true,
    featured: false,
    publishedAt,
    ingestedAt: new Date().toISOString(),
  };
}

function mergeBucket(existing, incoming, { pruneGnfpNonFilm } = {}) {
  const byId = new Map();
  for (const row of existing || []) {
    if (row?.id) byId.set(row.id, row);
  }
  let added = 0;
  let updated = 0;
  for (const row of incoming) {
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, row);
      added += 1;
      continue;
    }
    // Keep manual featured / dek overrides; refresh title/thumb/dates from feed.
    byId.set(row.id, {
      ...prev,
      title: row.title || prev.title,
      thumbUrl: row.thumbUrl || prev.thumbUrl,
      // Keep first-seen publishedAt so search re-sync does not reshuffle the feed.
      publishedAt: prev.publishedAt || row.publishedAt,
      source: prev.source || row.source,
      autoUpdate: true,
      mediaReady: true,
      ingestedAt: row.ingestedAt,
    });
    updated += 1;
  }
  let merged = Array.from(byId.values());
  if (pruneGnfpNonFilm) {
    merged = merged.filter((row) => isGnfpFilmBreakdownTitle(row?.title));
  }
  merged.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
  return { rows: merged, added, updated };
}


const DEFAULT_SEARCH_QUERIES = [
  'Florida Football Press Conference',
  'Florida Football Media Availability',
  'Florida SEC Media Days Press Conference',
  'Florida HC Jon Sumrall Press Conference',
];

function searchQueries() {
  const raw = String(process.env.FILM_ROOM_YOUTUBE_SEARCH_QUERIES || '').trim();
  if (!raw) return DEFAULT_SEARCH_QUERIES.slice();
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

async function fetchSearchVideoIds(query, limit = 12) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultFilmRoom/1.0)',
      Accept: 'text/html',
    },
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`YouTube search HTTP ${res.status}`);
  const html = await res.text();
  const ids = [];
  const re = /watch\?v=([a-zA-Z0-9_-]{11})/g;
  let m;
  while ((m = re.exec(html)) && ids.length < limit) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

async function fetchOEmbed(youtubeId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`;
  const res = await fetch(url, { timeout: 15000, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  return {
    youtubeId,
    title: String(json.title || '').trim(),
    author: String(json.author_name || '').trim(),
    thumbUrl: String(json.thumbnail_url || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`),
    publishedAt: new Date().toISOString(),
  };
}

function shouldKeepSearchHit(entry) {
  const title = entry.title || '';
  if (!title) return false;
  if (NON_FOOTBALL.test(title) && !/football/i.test(title)) return false;
  // Drop reaction shorts / meme clips that only mention a presser.
  if (/[😂📱]|phone went off|message after a reporter|tight ship and he/i.test(title)) return false;
  if (!PRESSER_TITLE.test(title) && !/\bsec media days\b/i.test(title)) return false;
  // Must look like Florida football context
  if (!/\bflorida\b|\bgators\b|\bsumrall\b/i.test(title)) return false;
  // Prefer real event titles (Coach/HC/Florida … Press Conference), not loose mentions.
  if (
    !/\b(press conference|media availability|media days?)\b/i.test(title) ||
    !/^(florida|coach|hc|sec)\b/i.test(title.trim())
  ) {
    return false;
  }
  return true;
}

async function syncYouTubeSearchPressers() {
  if (String(process.env.FILM_ROOM_YOUTUBE_SEARCH_DISABLED || '').toLowerCase() === 'true') {
    return { enabled: false, added: 0, matched: 0, scanned: 0 };
  }
  const ids = new Set();
  for (const q of searchQueries()) {
    try {
      for (const id of await fetchSearchVideoIds(q)) ids.add(id);
    } catch (err) {
      // soft-fail one query
    }
  }
  const kept = [];
  for (const id of ids) {
    try {
      const meta = await fetchOEmbed(id);
      if (!meta || !shouldKeepSearchHit(meta)) continue;
      // oEmbed has no publish date — leave null so channel RSS dates win in merge/sort.
      kept.push(toCacheRow({
        youtubeId: meta.youtubeId,
        title: meta.title,
        publishedAt: null,
        thumbUrl: meta.thumbUrl,
      }, {
        bucket: 'pressers',
        label: meta.author ? `${meta.author}` : 'YouTube',
        kind: 'search',
      }));
    } catch {
      // ignore bad ids
    }
  }
  return { enabled: true, rows: kept, scanned: ids.size, matched: kept.length };
}


async function syncFilmRoomYouTube({ sources } = {}) {
  const list = Array.isArray(sources) && sources.length ? sources : parseSourcesFromEnv();
  const cache = loadFilmRoomCache();
  const details = [];
  let totalAdded = 0;

  for (const source of list) {
    try {
      const entries = await fetchChannelFeed(source.channelId);
      const kept = entries.filter((e) => shouldKeepEntry(e, source)).map((e) => toCacheRow(e, source));
      const bucket = source.bucket === 'gnfp' ? 'gnfp' : 'pressers';
      const { rows, added, updated } = mergeBucket(cache.auto[bucket] || [], kept, {
        pruneGnfpNonFilm: bucket === 'gnfp',
      });
      cache.auto[bucket] = rows;
      totalAdded += added;
      details.push({
        channelId: source.channelId,
        label: source.label,
        bucket,
        scanned: entries.length,
        matched: kept.length,
        added,
        updated,
      });
    } catch (err) {
      details.push({
        channelId: source.channelId,
        label: source.label,
        error: err.message,
      });
    }
  }

  // Search ingest catches coach/player pressers posted off the official channel (Media Days, etc.).
  try {
    const search = await syncYouTubeSearchPressers();
    if (search.enabled) {
      const { rows, added, updated } = mergeBucket(cache.auto.pressers || [], search.rows || []);
      cache.auto.pressers = rows;
      totalAdded += added;
      details.push({
        channelId: 'youtube-search',
        label: 'YouTube search (Florida football pressers)',
        bucket: 'pressers',
        scanned: search.scanned,
        matched: search.matched,
        added,
        updated,
      });
    } else {
      details.push({ channelId: 'youtube-search', label: 'YouTube search', enabled: false });
    }
  } catch (err) {
    details.push({ channelId: 'youtube-search', label: 'YouTube search', error: err.message });
  }

  const saved = saveFilmRoomCache(cache);
  return {
    ok: true,
    added: totalAdded,
    saved,
    sources: details,
    counts: {
      pressers: (cache.auto.pressers || []).length,
      gnfp: (cache.auto.gnfp || []).length,
    },
  };
}

module.exports = {
  DEFAULT_SOURCES,
  parseSourcesFromEnv,
  parseRssEntries,
  isGnfpFilmBreakdownTitle,
  shouldKeepEntry,
  shouldKeepSearchHit,
  toCacheRow,
  mergeBucket,
  fetchChannelFeed,
  syncYouTubeSearchPressers,
  syncFilmRoomYouTube,
};
