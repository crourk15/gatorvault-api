/**
 * Postgres-backed UI endpoints — class metrics, battles, beat intel (oEmbed).
 */
const fetch = require('node-fetch');

async function fetchTwitterOembed(url) {
  if (!url || !/twitter\.com|x\.com/i.test(url)) return null;
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true`;
    const res = await fetch(oembedUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'GatorVault/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.html === 'string' ? data.html : null;
  } catch {
    return null;
  }
}

function beatPostUrl(post) {
  return post.url || post.link || post.xUrl || post.sourceUrl || null;
}

async function buildBeatIntelItems(limit = 5) {
  const liveBeat = require('./live-beat');
  const beatFilters = require('./beat-writer-filters');
  const { posts: rawPosts = [] } = liveBeat.getBeatPosts(Math.max(limit * 4, 16));
  const { kept } = beatFilters.filterBeatPosts
    ? beatFilters.filterBeatPosts(rawPosts)
    : { kept: rawPosts };
  const pool = kept.length ? kept : rawPosts;
  const posts = beatFilters.pickBeatHighlightPosts
    ? beatFilters.pickBeatHighlightPosts(pool, limit)
    : pool.slice(0, limit);

  const items = [];
  for (const post of posts) {
    const url = beatPostUrl(post);
    const embedHtml = url ? await fetchTwitterOembed(url) : null;
    items.push({
      id: post.id || post.tweetId || url || `beat_${items.length}`,
      text: post.text || post.fullText || '',
      writerName: post.writerName || post.author || post.handle || 'UF Beat',
      handle: post.handle || null,
      source: post.outlet || post.source || 'beat',
      url,
      timestamp: post.timestamp || post.createdAt || post.publishedAt || new Date().toISOString(),
      embedHtml,
    });
  }
  return items;
}

async function buildBattlesAndMovement(year = 2027) {
  const { buildHubBattles, buildHubMovementFeed } = require('./recruiting-hub-elite');
  const [battles, movement] = await Promise.all([
    buildHubBattles(year),
    buildHubMovementFeed(year),
  ]);
  return { battles, movement };
}

module.exports = {
  fetchTwitterOembed,
  buildBeatIntelItems,
  buildBattlesAndMovement,
};
