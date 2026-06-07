const fetch = require('node-fetch');
const { parseRssItems } = require('./rss-parse');
const store = require('./live-store');

function buildPlatforms(podcast) {
  const platforms = [];
  const apple =
    podcast.appleUrl ||
    (podcast.appleId ? `https://podcasts.apple.com/podcast/id${podcast.appleId}` : null);
  if (apple) platforms.push({ id: 'apple', label: 'Apple Podcasts', url: apple });
  if (podcast.spotifyUrl) platforms.push({ id: 'spotify', label: 'Spotify', url: podcast.spotifyUrl });
  if (podcast.youtubeUrl) platforms.push({ id: 'youtube', label: 'YouTube', url: podcast.youtubeUrl });
  if (podcast.siteUrl) platforms.push({ id: 'web', label: 'Website', url: podcast.siteUrl });
  return platforms;
}

async function resolveFeedUrl(podcast) {
  if (podcast.rssUrl) return podcast.rssUrl;
  if (!podcast.appleId) return null;
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${podcast.appleId}`);
    const json = await res.json();
    return json.results?.[0]?.feedUrl || null;
  } catch (e) {
    return null;
  }
}

async function fetchPodcastShow(podcast) {
  const feedUrl = await resolveFeedUrl(podcast);
  if (!feedUrl) {
    return { ...podcast, feedUrl: null, episodes: [], error: 'No RSS URL' };
  }
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'GatorVaultLive/1.0', Accept: 'application/rss+xml, application/xml' }
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  const channelImage =
    (xml.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/i) || [])[1] ||
    (xml.match(/<itunes:image[^>]+href=["']([^"']+)["']/i) || [])[1];
  const episodes = parseRssItems(xml, 12).map((ep) => ({
    id: `${podcast.id}_${ep.id}`,
    showId: podcast.id,
    showName: podcast.name,
    title: ep.title,
    description: ep.summary,
    imageUrl: ep.imageUrl || channelImage || null,
    playUrl: ep.link || podcast.siteUrl || null,
    publishedAt: ep.publishedAt
  }));
  return {
    id: podcast.id,
    name: podcast.name,
    feedUrl,
    siteUrl: podcast.siteUrl || null,
    imageUrl: channelImage || episodes[0]?.imageUrl || null,
    platforms: buildPlatforms(podcast),
    episodes
  };
}

async function refreshPodcasts() {
  const configs = store.loadPodcasts();
  const shows = [];
  const errors = [];

  for (const cfg of configs) {
    try {
      const show = await fetchPodcastShow(cfg);
      shows.push(show);
      if (show.episodes && show.episodes[0]) {
        const latest = show.episodes[0];
        store.upsertFeedItem({
          id: latest.id,
          dedupeKey: latest.id,
          type: 'podcast',
          title: `New episode: ${show.name} — ${latest.title}`,
          summary: latest.description,
          source_url: latest.playUrl || null,
          imageUrl: latest.imageUrl || show.imageUrl,
          source: 'rss',
          author: show.name,
          createdAt: latest.publishedAt,
          meta: { showId: show.id }
        });
      }
    } catch (e) {
      errors.push({ id: cfg.id, error: e.message });
      const prev = store.loadPodcastCache().shows?.find((s) => s.id === cfg.id);
      if (prev) shows.push(prev);
    }
  }

  const cache = { shows, fetchedAt: store.nowIso(), errors };
  store.savePodcastCache(cache);
  return cache;
}

function getPodcastHub() {
  const cache = store.loadPodcastCache();
  return {
    shows: cache.shows || [],
    fetchedAt: cache.fetchedAt,
    errors: cache.errors || []
  };
}

module.exports = {
  refreshPodcasts,
  getPodcastHub,
  fetchPodcastShow
};
