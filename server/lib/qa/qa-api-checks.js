/**
 * API endpoint smoke + contract checks.
 */
const config = require('./qa-config');
const { check, fetchJson, fetchJsonWithRetry, waitForApiWarmup, moduleResult } = require('./qa-utils');
const { sortArticlesByPublishedAtDesc } = require('../article-sort');

function assertSortedArticles(items, label) {
  const sorted = sortArticlesByPublishedAtDesc(items);
  for (let i = 0; i < items.length - 1; i += 1) {
    const a = items[i];
    const b = items[i + 1];
    const aMs = new Date(a.publishedAt || a.createdAt || a.date || 0).getTime();
    const bMs = new Date(b.publishedAt || b.createdAt || b.date || 0).getTime();
    const sortedA = sorted[i];
    const sortedB = sorted[i + 1];
    if (sortedA.id !== a.id || sortedB.id !== b.id) {
      const err = new Error(`${label} not sorted by publishedAt DESC`);
      err.details = { index: i, a: a.id, b: b.id };
      err.repro = `GET ${label} and verify publishedAt descending order`;
      throw err;
    }
    if (aMs < bMs) {
      const err = new Error(`${label} date order invalid at index ${i}`);
      err.details = { a: a.publishedAt || a.date, b: b.publishedAt || b.date };
      throw err;
    }
  }
}

function validateEndpointBody(ep, body) {
  if (ep.validate === 'filmCatalog') {
    if (!body?.ok && body?.items == null) throw new Error('Film catalog missing items');
    const items = body.items || [];
    const lessons = items.filter((i) => i.knowledgeEngine || i.noVideo);
    if (!lessons.length) throw new Error('No Knowledge Engine lessons in catalog');
    const withSources = lessons.filter((i) => i.sources?.length);
    if (!withSources.length) throw new Error('Knowledge Engine lessons missing sources array');
    return { count: items.length, lessons: lessons.length };
  }
  if (ep.validate === 'articlesSorted') {
    const items = body.articles || body.items || [];
    if (items.length > 1) assertSortedArticles(items, '/api/articles/published');
    return { count: items.length };
  }
  if (ep.validate === 'contentSorted') {
    const items = body.articles || body.items || [];
    if (items.length > 1) assertSortedArticles(items, '/api/content/published');
    return { count: items.length };
  }
  if (ep.validate === 'roster') {
    const players = body.players || body.items || [];
    if (!players.length) throw new Error('Roster empty');
    const bad = players.find((p) => !p.name || !p.slug);
    if (bad) throw new Error('Roster player missing name or slug');
    return { count: players.length };
  }
  if (body && typeof body === 'object' && body.ok === false && !ep.allowNotOk) {
    throw new Error(body.error || 'API returned ok:false');
  }
  return null;
}

async function runApiChecks() {
  await waitForApiWarmup();

  const fetchForEndpoint = (ep) => {
    const url = `${config.API_URL}${ep.path}`;
    if (ep.id === 'live-dashboard') {
      return fetchJsonWithRetry(url, {
        retries: config.LIVE_DASHBOARD_RETRIES,
        retryDelayMs: config.LIVE_DASHBOARD_RETRY_MS,
        timeout: Math.max(config.FETCH_TIMEOUT_MS, 30000)
      });
    }
    if (ep.id === 'live-feed' || ep.id === 'live-pipeline-health') {
      return fetchJsonWithRetry(url, { retries: 2, timeout: config.FETCH_TIMEOUT_MS });
    }
    return fetchJson(url, { retries: 1, timeout: config.FETCH_TIMEOUT_MS });
  };

  const checks = await Promise.all(
    config.PUBLIC_API_ENDPOINTS.map((ep) =>
      check(`api:${ep.id}`, 'api', ep.path, async () => {
        const { body } = await fetchForEndpoint(ep);
        const details = validateEndpointBody(ep, body);
        return details || { ok: true };
      })
    )
  );

  // Film Room lesson detail — public knowledge engine route
  checks.push(
    await check('api:film-room-lesson', 'api', 'Film Room lesson detail', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/film-room/catalog`);
      const lesson = (body.items || []).find((i) => i.knowledgeEngine || i.noVideo);
      if (!lesson) throw new Error('No lesson for detail probe');
      const slug = lesson.slug || lesson.id;
      let j;
      try {
        const detail = await fetchJson(
          `${config.API_URL}/api/film-room/knowledge/lesson/${encodeURIComponent(slug)}`
        );
        j = detail.body;
      } catch {
        const detail = await fetchJson(
          `${config.API_URL}/api/film-room/lesson/${encodeURIComponent(slug)}`,
          { allowNotOk: true }
        );
        j = detail.body;
      }
      if (!j?.body && !j?.summary) throw new Error('Lesson detail missing body');
      if (!j?.sources?.length) throw new Error('Lesson detail missing sources');
      const noUrl = j.sources.filter((s) => !s.source_url);
      if (noUrl.length) throw new Error(`${noUrl.length} verified source(s) missing source_url`);
      return { slug, sources: j.sources.length };
    })
  );

  // Legacy video embed check
  checks.push(
    await check('api:film-room-legacy-video', 'api', 'Legacy Film Room video', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/film-room/catalog`);
      const video = (body.items || []).find((i) => i.youtubeId || i.embedUrl);
      if (!video) return { skipped: true, reason: 'no_legacy_videos_in_catalog' };
      if (!video.youtubeId && !video.embedUrl) throw new Error('Legacy video missing embed');
      return { title: video.title, youtubeId: video.youtubeId || null };
    })
  );

  // Schedule / games — via live dashboard
  checks.push(
    await check('api:schedule', 'api', 'Schedule (live dashboard games)', async () => {
      const { body } = await fetchJsonWithRetry(`${config.API_URL}/api/live/dashboard`, {
        retries: config.LIVE_DASHBOARD_RETRIES,
        retryDelayMs: config.LIVE_DASHBOARD_RETRY_MS,
        timeout: Math.max(config.FETCH_TIMEOUT_MS, 30000)
      });
      const games = body?.games || body?.schedule || [];
      if (!Array.isArray(games)) return { skipped: true };
      return { games: games.length };
    })
  );

  return moduleResult('api', checks);
}

module.exports = { runApiChecks };
