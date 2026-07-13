/**
 * Recruiting Hub spec endpoints — class, player, intel, targets.
 */
require('tsx/cjs');

const store = require('./recruiting-store');
const gm2 = require('./gm2');
const { enrichBoard } = require('./recruiting-board-enrich');
const {
  hubCache,
  clearHubCache,
  sendHubJson,
  classSnapshotCacheKey,
  eliteClassOverviewCacheKey,
  eliteClassOverviewAllCacheKey,
  eliteBundleCacheKey,
} = require('./recruiting-hub-cache');

function avgStars(players) {
  if (!players.length) return 0;
  return players.reduce((acc, p) => acc + (Number(p.stars) || 0), 0) / players.length;
}

function blueChipRatio(players) {
  if (!players.length) return 0;
  const blue = players.filter((p) => (Number(p.stars) || 0) >= 4).length;
  return Math.round((blue / players.length) * 100) / 100;
}

function inStateRatio(players) {
  if (!players.length) return 0;
  const instate = players.filter((p) => p.inState || String(p.state || '').toUpperCase() === 'FL').length;
  return Math.round((instate / players.length) * 100) / 100;
}

function buildClassPayload(year, commits, rankings, compareRankings) {
  const nationalRank = rankings?.nationalRank ?? 0;
  const prevNational = compareRankings?.nationalRank;
  const yoyMovement =
    prevNational != null && nationalRank > 0 ? prevNational - nationalRank : 0;

  return {
    year,
    commits: commits.length,
    classScore: rankings?.classScore ?? Math.round(avgStars(commits) * 100) / 100,
    nationalRank,
    secRank: rankings?.secRank ?? 0,
    blueChipRatio: blueChipRatio(commits),
    inStateRatio: inStateRatio(commits),
    yoyMovement,
    players: commits.map(mapPlayerToHub),
  };
}

function mapPlayerToHub(player) {
  const intel = [];
  const note = player.notePreview || player.insiderNotes || player.notes;
  if (note) {
    intel.push({
      id: `${player.slug}-note`,
      playerId: player.slug,
      timestamp: player.visitStart || player.commitDate || new Date().toISOString(),
      text: note,
      ufProbability:
        player.ufProbability != null
          ? player.ufProbability <= 1
            ? Math.round(player.ufProbability * 100)
            : Math.round(player.ufProbability)
          : 0,
    });
  }

  return {
    id: player.slug,
    slug: player.slug,
    name: player.name,
    position: player.position || player.pos || null,
    pos: player.pos || player.position || null,
    class: player.classYear,
    classYear: player.classYear,
    rating: player.rating ?? player.displayRating ?? null,
    nationalRank: player.natlRank ?? player.natl ?? null,
    natlRank: player.natlRank ?? player.natl ?? null,
    stateRank: player.stateRank ?? null,
    positionRank: player.posRank ?? null,
    posRank: player.posRank ?? null,
    status: player.isCommittedToUF ? 'commit' : player.isTarget ? 'target' : player.status || 'target',
    fitScore: player.fitScore ?? null,
    skinny: player.skinny ?? player.profileNote ?? null,
    strengths: player.strengths ?? [],
    weaknesses: player.weaknesses ?? [],
    evaluatorNotes: player.evaluatorNotes ?? player.notes ?? null,
    commitmentDate: player.commitDate ?? null,
    commitDate: player.commitDate ?? null,
    stars: player.stars,
    school: player.school,
    state: player.state,
    inState: player.inState,
    ufProbability: player.ufProbability ?? null,
    tier: player.tier,
    isCommittedToUF: player.isCommittedToUF,
    isTarget: player.isTarget,
    intel,
  };
}

function mapIntelFromIntelRow(intel, player) {
  const uf =
    intel.confidencePct != null
      ? Math.round(intel.confidencePct)
      : player?.ufProbability != null
        ? player.ufProbability <= 1
          ? Math.round(player.ufProbability * 100)
          : Math.round(player.ufProbability)
        : player?.rivalsConfidence != null
          ? Math.round(player.rivalsConfidence)
          : 0;
  return {
    id: intel.id || intel.fingerprint,
    playerId: player?.slug || intel.playerSlug || intel.playerId,
    playerSlug: player?.slug || intel.playerSlug || null,
    timestamp: intel.reportedAt || intel.timestamp || intel.createdAt || new Date().toISOString(),
    text: intel.text || intel.detail || 'Insider tracking active.',
    ufProbability: uf,
  };
}

async function buildHighPriorityIntel(limit = 12) {
  const intelStore = require('./recruiting-intel-store');
  if (typeof intelStore.initIntelStore === 'function') {
    await intelStore.initIntelStore().catch(() => {});
  }
  const { intel } = gm2.getPublicIntel({ limit: Math.max(limit, 50), subsystem: 'recruiting-hub' });
  const allPlayers = await store.getAllPlayers();
  const bySlug = new Map();
  const byOn3 = new Map();
  for (const p of allPlayers) {
    if (p.slug) bySlug.set(p.slug, p);
    if (p.on3Id) byOn3.set(String(p.on3Id), p);
  }

  const items = [];
  for (const row of intel) {
    const player =
      (row.playerSlug && bySlug.get(row.playerSlug)) ||
      (row.playerId && byOn3.get(String(row.playerId))) ||
      null;
    items.push(mapIntelFromIntelRow(row, player));
    if (items.length >= limit) break;
  }
  return items;
}

function clearHubCacheExport() {
  clearHubCache();
}

function mountRecruitingHubRoutes(app) {
  function hubMeta(extra = {}) {
    const now = new Date().toISOString();
    return {
      dataSource: store.getStoreInfo(),
      generatedAt: now,
      lastUpdated: now,
      ...extra
    };
  }

  app.get('/api/recruiting/class/:year', async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      if (!Number.isFinite(year)) {
        return res.status(400).json({ ok: false, error: 'Invalid class year' });
      }
      const compareYear = year === 2027 ? 2026 : year === 2028 ? 2027 : null;
      const cacheKey = `hub:class:${year}`;

      const { value } = await hubCache.wrap(cacheKey, async () => {
        const board = await store.getBoard(year);
        const enriched = enrichBoard(board, false);
        let compareRankings = null;
        if (compareYear) {
          const prevBoard = await store.getBoard(compareYear);
          const prevEnriched = enrichBoard(prevBoard, false);
          compareRankings = prevEnriched.rankings;
        }
        const commits = enriched.commits || [];
        return buildClassPayload(year, commits, enriched.rankings, compareRankings);
      });

      return res.json({ ok: true, meta: hubMeta({ cacheKey }), ...value });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/player/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'Missing player id' });
      const cacheKey = `hub:player:${id}`;

      const { value: player } = await hubCache.wrap(cacheKey, async () => {
        const hit =
          (typeof store.resolvePlayerKey === 'function'
            ? await store.resolvePlayerKey(id)
            : null) || (await store.getPlayerBySlug(id));
        if (hit) return hit;
        const all = await store.getAllPlayers();
        return all.find((p) => p.slug === id || String(p.on3Id || '') === id || p.name === id) || null;
      });

      if (!player) return res.status(404).json({ ok: false, error: 'Player not found' });
      return res.json({ ok: true, meta: hubMeta({ cacheKey }), player: mapPlayerToHub(player) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/intelligence/tier-a/gaps', async (req, res) => {
    try {
      const adminPin = String(process.env.ADMIN_PIN || '');
      const pin = String(req.query.pin || req.headers['x-admin-pin'] || '').trim();
      if (adminPin && pin !== adminPin) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      const { listTierAGaps } = require('./player-intelligence/orchestrator');
      const gaps = await listTierAGaps();
      return res.json({
        ok: true,
        meta: hubMeta({ tier: 'A', count: gaps.length }),
        gaps
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/intelligence/refresh', async (req, res) => {
    try {
      const pin = String(req.body?.pin || req.query.pin || req.headers['x-admin-pin'] || '').trim();
      const cron = require('./ingest-cron-auth');
      const cronOk = typeof cron.isIngestCronAuthorized === 'function' && cron.isIngestCronAuthorized(req);
      const pinOk = pin && pin === String(process.env.ADMIN_PIN || '');
      if (!cronOk && !pinOk) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      const { refreshTierAPlayers, refreshPlayerIntelligence } = require('./player-intelligence/orchestrator');
      const slug = String(req.body?.slug || req.query.slug || '').trim().toLowerCase();
      if (slug) {
        const result = await refreshPlayerIntelligence(slug, { force: true, reactive: true });
        return res.json({ ok: true, result });
      }
      const limit = Number(req.body?.limit || req.query.limit || 0);
      const result = await refreshTierAPlayers({ limit: limit > 0 ? limit : 0, verbose: req.body?.verbose === true });
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/intelligence/:slug', async (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim().toLowerCase();
      if (!slug) return res.status(400).json({ ok: false, error: 'Missing player slug' });
      const { getPlayerIntelligence } = require('./player-intelligence');
      const cacheKey = `hub:intelligence:${slug}`;
      const { value } = await hubCache.wrap(cacheKey, () => getPlayerIntelligence(slug));
      if (!value) return res.status(404).json({ ok: false, error: 'Player not found' });
      return res.json({ ok: true, meta: hubMeta({ cacheKey }), intelligence: value });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/intel/high-priority', async (req, res) => {
    try {
      const force = req.query.force === '1' || req.query.force === 'true';
      const cacheKey = 'hub:intel:high-priority';
      let value;
      if (force) {
        value = await buildHighPriorityIntel();
      } else {
        const result = await hubCache.wrap(cacheKey, () => buildHighPriorityIntel());
        value = result.value;
      }
      return res.json({
        ok: true,
        meta: hubMeta({ cacheKey, forced: force, lastUpdated: new Date().toISOString() }),
        items: value,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  const { buildRecruitingMovementIntelPayload } = require('../api/recruiting/movement-intel.ts');
  app.get('/api/recruiting/movement-intel', async (req, res) => {
    try {
      const force = req.query.force === '1' || req.query.force === 'true';
      const cacheKey = 'recruiting:movement';
      let value;
      if (force) {
        value = await buildRecruitingMovementIntelPayload();
      } else {
        const result = await hubCache.wrap(cacheKey, () => buildRecruitingMovementIntelPayload());
        value = result.value;
      }
      return res.json({
        ...value,
        meta: hubMeta({ cacheKey, forced: force, lastUpdated: value.lastUpdated || new Date().toISOString() }),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  const { handleGetMovementWindow } = require('../api/recruiting/movement-window.ts');
  app.get('/api/recruiting/movement-window', handleGetMovementWindow);

  const { handleGetCompetingDeltas } = require('../api/recruiting/competing-deltas.ts');
  app.get('/api/recruiting/competing-deltas', handleGetCompetingDeltas);

  const { handleGetMovementSummary } = require('../api/recruiting/movement-summary.ts');
  app.get('/api/recruiting/movement-summary', handleGetMovementSummary);

  app.get('/api/recruiting/targets/:year', async (req, res) => {
    try {
      const year = parseInt(req.params.year, 10);
      if (!Number.isFinite(year)) {
        return res.status(400).json({ ok: false, error: 'Invalid class year' });
      }
      const cacheKey = `hub:targets:${year}`;
      const { value } = await hubCache.wrap(cacheKey, async () => {
        const board = await store.getBoard(year);
        const enriched = enrichBoard(board, false);
        return (enriched.targets || []).map(mapPlayerToHub);
      });
      return res.json({ ok: true, meta: hubMeta({ cacheKey }), items: value });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  const {
    buildHubTicker,
    buildHubClassOverview,
    buildHubClassOverviewAll,
    buildHubCommits,
    buildHubBattles,
    buildHubPositions,
    buildHubHeatIndex,
    buildHubMovementFeed,
    buildHubBattleBoard,
    buildHubFootprint,
    buildHubHero,
    buildHubBundle,
  } = require('./recruiting-hub-elite');

  function parseHubYear(req) {
    const year = parseInt(String(req.query.year || '2027'), 10);
    return Number.isFinite(year) ? year : 2027;
  }

  const { buildBeatIntelItems, buildBattlesAndMovement } = require('./recruiting-ui-api');

  app.get('/api/recruiting/class-metrics', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = classSnapshotCacheKey(year);
      const force =
        req.query.force === '1' ||
        req.query.force === 'true' ||
        req.query.refresh === '1' ||
        req.query.refresh === 'true';
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'class-metrics',
        builder: () => buildHubClassOverview(year),
        spread: true,
        hubMeta,
        force,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/battles', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `recruiting:battles:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'battles',
        builder: () => buildHubBattleBoard(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/battles-and-movement', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `recruiting:battles-and-movement:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'battles-and-movement',
        builder: () => buildBattlesAndMovement(year),
        spread: true,
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/heat-index', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `recruiting:heat-index:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'heat-index',
        builder: () => buildHubHeatIndex(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/positions', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `recruiting:positions:v2:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'positions',
        builder: () => buildHubPositions(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/footprint', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `recruiting:footprint:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'footprint',
        builder: () => buildHubFootprint(year),
        spread: true,
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/intel/beat', async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit || '5'), 10);
      const force = req.query.force === '1' || req.query.force === 'true';
      const cacheKey = 'hub:intel:beat';
      let items;
      if (force) {
        items = await buildBeatIntelItems(limit);
      } else {
        const result = await hubCache.wrap(cacheKey, () => buildBeatIntelItems(limit));
        items = result.value;
      }
      return res.json({
        ok: true,
        meta: hubMeta({ cacheKey, forced: force, lastUpdated: new Date().toISOString() }),
        items,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/hero', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:hero:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'hero',
        builder: () => buildHubHero(year),
        spread: true,
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/bundle', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = eliteBundleCacheKey(year);
      const bundleTimeoutMs = parseInt(process.env.HUB_BUNDLE_BUILD_TIMEOUT_MS || '45000', 10);
      const force = req.query.force === '1' || req.query.force === 'true';
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'bundle',
        builder: () => buildHubBundle(year),
        spread: true,
        hubMeta,
        timeoutMs: bundleTimeoutMs,
        force,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/ticker', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:ticker:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'ticker',
        builder: () => buildHubTicker(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/class-overview/all', async (req, res) => {
    try {
      const cacheKey = eliteClassOverviewAllCacheKey();
      return sendHubJson(res, {
        cacheKey,
        endpoint: 'class-overview-all',
        builder: () => buildHubClassOverviewAll(),
        spread: true,
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/class-overview', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = eliteClassOverviewCacheKey(year);
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'class-overview',
        builder: () => buildHubClassOverview(year),
        spread: true,
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/commits', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:commits:v3:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'commits',
        builder: () => buildHubCommits(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/battles', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:battles:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'battles',
        builder: () => buildHubBattles(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/positions', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:positions:v2:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'positions',
        builder: () => buildHubPositions(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/heat-index', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:heat-index:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'heat-index',
        builder: () => buildHubHeatIndex(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/movement-feed', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:movement-feed:v3:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'movement-feed',
        builder: () => buildHubMovementFeed(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/battle-board', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:battle-board:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'battle-board',
        builder: () => buildHubBattleBoard(year),
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/hub/footprint', async (req, res) => {
    try {
      const year = parseHubYear(req);
      const cacheKey = `hub:elite:footprint:${year}`;
      return sendHubJson(res, {
        cacheKey,
        year,
        endpoint: 'footprint',
        builder: () => buildHubFootprint(year),
        spread: true,
        hubMeta,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/hub/refresh', async (req, res) => {
    try {
      const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
      const isCron = cronSecret && req.headers['x-monitoring-cron'] === cronSecret;
      if (!isCron && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const { refreshRecruitingHubCaches } = require('./recruiting-hub-refresh');
      const geoBackfill =
        req.query.geoBackfill === 'true' || req.query.geoBackfill === '1';
      const result = await refreshRecruitingHubCaches({ geoBackfill });
      return res.json({ ok: true, meta: hubMeta(), ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountRecruitingHubRoutes, buildClassPayload, mapPlayerToHub, clearHubCache: clearHubCacheExport, buildHighPriorityIntel };
