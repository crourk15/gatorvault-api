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

/**
 * Collapse same-day / same-speaker pressers that landed as different YouTube IDs
 * (official re-upload + search mirrors). Keep distinct speakers on the same day
 * (SEC Media Days Baugh vs Graham vs Brown).
 *
 * Speaker keys use last name when the title has a person ("Jon Sumrall" / "Coach Sumrall"
 * → sumrall) so official + mirror titles do not double the hub rail.
 */
function speakerKeyFromCleanedName(cleaned) {
  const parts = String(cleaned || '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (parts.length && (parts[0] === 'florida' || parts[0] === 'gators')) parts.shift();
  if (!parts.length) return '';
  // Event / session labels — keep joined (Spring Game, Spring Practice No …).
  if (/^(spring|media|practice|press|pre|post|game|availability|opening|closing)$/.test(parts[0])) {
    return parts.join(' ').slice(0, 40);
  }
  // Team dump titles with no person — keep joined so they do not collide with people.
  if (parts.every((p) => /^(florida|gators|football|team|athletics)$/.test(p))) {
    return parts.join(' ').slice(0, 40);
  }
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
  if (parts.length >= 2 && suffixes.has(parts[parts.length - 1])) {
    return parts[parts.length - 2];
  }
  if (parts.length >= 2) return parts[parts.length - 1];
  return parts[0];
}

function normalizePresserSpeaker(title) {
  const t = String(title || '');
  if (!t) return '';
  const nameStop = /^(press|media|availability|sec|conference|days?|at|the|and)$/i;
  // Prefer explicit Coach / HC / Head Coach name anywhere in the title.
  // Capture stops at non-letter boundaries so "Coach Sumrall Press…" / "HC Jon Sumrall - SEC…" work.
  const coach = t.match(
    /\b(?:coach|hc|head coach)\s+((?:[A-Za-z][A-Za-z.']+)(?:\s+[A-Za-z][A-Za-z.']+){0,2})/i
  );
  if (coach) {
    const tokens = coach[1].split(/\s+/).filter((w) => !nameStop.test(w));
    const key = speakerKeyFromCleanedName(tokens.join(' '));
    if (key && key.length >= 2) return key;
  }
  const afterSep = t.split(/\s*[|—–]\s*/).pop() || '';
  const cleaned = afterSep
    .replace(/\bSEC Media Days?\b/gi, ' ')
    .replace(/\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/g, ' ')
    .replace(/\b(press conference|media availability|media days?|availability)\b/gi, ' ')
    .replace(/\b(coach|hc|head coach)\b/gi, ' ')
    .replace(/[^a-zA-Z\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const fromSep = speakerKeyFromCleanedName(cleaned);
  if (fromSep && fromSep.length >= 3 && fromSep.length <= 40) return fromSep;
  // Full-title fallback (search mirrors without a clean pipe segment).
  const full = t
    .replace(/\bSEC Media Days?\b/gi, ' ')
    .replace(/\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/g, ' ')
    .replace(/\b(press conference|media availability|media days?|availability)\b/gi, ' ')
    .replace(/\b(coach|hc|head coach)\b/gi, ' ')
    .replace(/[^a-zA-Z\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return speakerKeyFromCleanedName(full);
}

function presserEventKey(row) {
  const day = String(row?.publishedAt || '').slice(0, 10) || 'nodate';
  const speaker = normalizePresserSpeaker(row?.title);
  if (speaker) return `${day}|${speaker}`;
  // No speaker — only collapse exact title matches on the same day.
  const titleKey = String(row?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 60);
  return titleKey ? `${day}|title:${titleKey}` : null;
}

function presserPreferenceScore(row) {
  let score = 0;
  const src = String(row?.source || '');
  const title = String(row?.title || '');
  if (/florida gators football/i.test(src)) score += 100;
  else if (/florida gators youtube/i.test(src)) score += 90;
  else if (/florida gators/i.test(src)) score += 70;
  if (row?.publishedAt) score += 25;
  if (/^florida football (press conference|media availability)/i.test(title)) score += 35;
  if (/\b(film guy|insider|fox\s?\d+|reaction|interview)\b/i.test(`${src} ${title}`)) score -= 60;
  if (/youtube-search|kind.:.search/i.test(src) || (!row?.publishedAt && /youtube/i.test(src))) {
    score -= 20;
  }
  const t = row?.publishedAt ? new Date(row.publishedAt).getTime() : 0;
  if (Number.isFinite(t) && t > 0) score += Math.min(5, t / 1e13);
  return score;
}

function dedupePressersByEvent(rows = []) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length < 2) return list.slice();
  const bestByKey = new Map();
  const passthrough = [];
  for (const row of list) {
    const key = presserEventKey(row);
    if (!key || key.startsWith('nodate|')) {
      // Search hits without dates: still collapse by speaker alone when possible.
      const speaker = normalizePresserSpeaker(row?.title);
      if (speaker) {
        const softKey = `soft|${speaker}`;
        const prevSoft = bestByKey.get(softKey);
        if (!prevSoft || presserPreferenceScore(row) > presserPreferenceScore(prevSoft)) {
          bestByKey.set(softKey, row);
        }
        continue;
      }
      passthrough.push(row);
      continue;
    }
    const prev = bestByKey.get(key);
    if (!prev || presserPreferenceScore(row) > presserPreferenceScore(prev)) {
      bestByKey.set(key, row);
    }
  }
  // Soft keys must not drop a dated official when both exist.
  const datedSpeakers = new Set(
    [...bestByKey.keys()]
      .filter((k) => /^\d{4}-\d{2}-\d{2}\|/.test(k))
      .map((k) => k.split('|').slice(1).join('|'))
  );
  for (const key of [...bestByKey.keys()]) {
    if (!key.startsWith('soft|')) continue;
    const speaker = key.slice(5);
    if (datedSpeakers.has(speaker)) bestByKey.delete(key);
  }
  const deduped = [...bestByKey.values(), ...passthrough];
  deduped.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
  return deduped;
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


async function syncFilmRoomYouTube(opts = {}) {
  const { runHeavyJob } = require('./heavy-job-gate');
  return runHeavyJob('film-room-youtube-sync', () => syncFilmRoomYouTubeInner(opts));
}

async function syncFilmRoomYouTubeInner({ sources } = {}) {
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

  // Same-day Sumrall / coach re-uploads + search mirrors must not double the hub rail.
  const beforeDedupe = (cache.auto.pressers || []).length;
  cache.auto.pressers = dedupePressersByEvent(cache.auto.pressers || []);
  const removedDupes = Math.max(0, beforeDedupe - cache.auto.pressers.length);
  if (removedDupes > 0) {
    details.push({
      channelId: 'presser-dedupe',
      label: 'Same-day speaker dedupe',
      removed: removedDupes,
    });
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
  normalizePresserSpeaker,
  presserEventKey,
  dedupePressersByEvent,
  fetchChannelFeed,
  syncYouTubeSearchPressers,
  syncFilmRoomYouTube,
};
