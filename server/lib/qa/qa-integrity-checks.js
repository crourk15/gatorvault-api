/**
 * Data integrity — duplicates, invalid values, broken links, images.
 */
const fs = require('fs');
const path = require('path');
const config = require('./qa-config');
const { check, fetchJson, fetchJsonWithRetry, headUrl, extractUrls, moduleResult } = require('./qa-utils');

function loadJson(relPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', relPath), 'utf8'));
  } catch {
    return null;
  }
}

function findDuplicateKeys(items, keyFn) {
  const seen = new Map();
  const dups = [];
  (items || []).forEach((item, idx) => {
    const key = keyFn(item, idx);
    if (!key) return;
    if (seen.has(key)) dups.push({ key, first: seen.get(key), duplicate: idx });
    else seen.set(key, idx);
  });
  return dups;
}

async function probeLinks(urls, limit = 12) {
  const broken = [];
  const sample = urls.slice(0, limit);
  await Promise.all(
    sample.map(async (url) => {
      const r = await headUrl(url);
      if (!r.ok) broken.push({ url, status: r.status, error: r.error || null });
    })
  );
  return broken;
}

async function runIntegrityChecks() {
  const checks = [];

  // Duplicate intel in live feed
  checks.push(
    await check('integrity:feed-dedup', 'integrity', 'Latest Updates dedup', async () => {
      const { body } = await fetchJsonWithRetry(`${config.API_URL}/api/live/feed`, {
        retries: 3,
        timeout: config.FETCH_TIMEOUT_MS
      });
      const items = body.feed || body.items || [];
      const dups = findDuplicateKeys(items, (i) => {
        const u = (i.url || i.link || '').trim();
        return u || null;
      });
      if (dups.length) {
        const err = new Error(`${dups.length} duplicate feed item(s)`);
        err.details = dups.slice(0, 5);
        err.repro = 'Open Latest Updates; check live-aggregator dedup rules';
        throw err;
      }
      return { count: items.length };
    })
  );

  // Recruiting rankings sanity
  checks.push(
    await check('integrity:rankings', 'integrity', 'Recruiting star ratings', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/recruiting/board`);
      const players = body.players || body.items || [];
      const bad = players.filter((p) => {
        const s = Number(p.stars);
        return p.stars != null && p.stars !== '' && (Number.isNaN(s) || s < 0 || s > 5);
      });
      if (bad.length) {
        const err = new Error(`${bad.length} player(s) with invalid stars`);
        err.details = bad.slice(0, 5).map((p) => ({ name: p.name, stars: p.stars }));
        throw err;
      }
      return { players: players.length };
    })
  );

  // Future-dated articles
  checks.push(
    await check('integrity:article-dates', 'integrity', 'Article date sanity', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/articles/published`);
      const articles = body.articles || body.items || [];
      const now = Date.now() + 86400000;
      const future = articles.filter((a) => {
        const ms = new Date(a.publishedAt || a.createdAt || a.date).getTime();
        return !Number.isNaN(ms) && ms > now;
      });
      if (future.length) {
        const err = new Error(`${future.length} article(s) dated in the future`);
        err.details = future.slice(0, 5).map((a) => ({ id: a.id, date: a.publishedAt || a.date }));
        throw err;
      }
      return { checked: articles.length };
    })
  );

  // Broken links in articles (sample)
  checks.push(
    await check('integrity:article-links', 'integrity', 'Article broken links (sample)', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/articles/published`);
      const articles = body.articles || body.items || [];
      const urls = [];
      articles.slice(0, 15).forEach((a) => {
        extractUrls(JSON.stringify(a)).forEach((u) => urls.push(u));
        (a.sources || []).forEach((s) => {
          if (s.url) urls.push(s.url);
          if (s.href) urls.push(s.href);
        });
      });
      const external = [...new Set(urls)].filter((u) => /^https?:/i.test(u) && !u.includes('gatorvault'));
      const broken = await probeLinks(external, 10);
      if (broken.length) {
        const err = new Error(`${broken.length} broken external link(s) in articles`);
        err.details = broken;
        err.repro = 'Open failing article sources; verify URLs still live';
        throw err;
      }
      return { probed: Math.min(external.length, 10) };
    })
  );

  // Film Room verified source URLs
  checks.push(
    await check('integrity:film-sources', 'integrity', 'Film Room source URLs', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/film-room/catalog`);
      const lessons = (body.items || []).filter((i) => i.knowledgeEngine);
      const urls = [];
      for (const l of lessons.slice(0, 8)) {
        (l.sources || []).forEach((s) => {
          if (s.source_url) urls.push(s.source_url);
        });
      }
      const unique = [...new Set(urls)];
      const broken = await probeLinks(unique, 8);
      if (broken.length) {
        const err = new Error(`${broken.length} broken Film Room source URL(s)`);
        err.details = broken;
        throw err;
      }
      return { sources: unique.length };
    })
  );

  // Missing roster headshots (sample)
  checks.push(
    await check('integrity:roster-images', 'integrity', 'Roster headshot coverage', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/roster/players`);
      const players = body.players || body.items || [];
      if (!players.length) throw new Error('No roster players');
      const missing = players.filter((p) => !p.headshot && !p.photo && !p.image && !p.headshotUrl);
      const pct = players.length ? Math.round((missing.length / players.length) * 100) : 0;
      if (players.length > 20 && pct === 100) {
        return { total: players.length, missingHeadshots: missing.length, pctMissing: pct, note: 'headshots_not_ingested' };
      }
      return { total: players.length, missingHeadshots: missing.length, pctMissing: pct };
    })
  );

  // Depth chart labels from meta file if present
  checks.push(
    await check('integrity:depth-chart', 'integrity', 'Depth chart metadata', async () => {
      const meta = loadJson('roster/depth-chart-meta.json');
      if (!meta) return { skipped: true, reason: 'no_depth_chart_meta' };
      const positions = meta.positions || meta.units || [];
      if (Array.isArray(positions) && !positions.length) throw new Error('Depth chart positions empty');
      return { positions: Array.isArray(positions) ? positions.length : 'ok' };
    })
  );

  // Missing intel — stale live dashboard
  checks.push(
    await check('integrity:live-freshness', 'integrity', 'Live pipeline freshness', async () => {
      const { body } = await fetchJson(`${config.API_URL}/api/live/pipeline/health`);
      const checksObj = body.checks || {};
      const staleFlags = Object.entries(checksObj).filter(([k, v]) => k.endsWith('Stale') && v === true);
      if (staleFlags.length >= 3) {
        const err = new Error('Multiple live pipeline feeds stale');
        err.details = staleFlags;
        throw err;
      }
      return { stale: staleFlags.length, beatError: checksObj.beatError || null };
    })
  );

  return moduleResult('integrity', checks);
}

module.exports = { runIntegrityChecks };
