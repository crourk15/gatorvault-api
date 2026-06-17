/**
 * Recruiting Hub spec endpoints — class, player, intel, targets.
 */
require('tsx/cjs');

const store = require('./recruiting-store');
const gm2 = require('./gm2');
const { enrichBoard } = require('./recruiting-board-enrich');
const { createMemoryCache } = require('./memory-cache');

const HUB_CACHE_MS = 5 * 60 * 1000;
const hubCache = createMemoryCache(HUB_CACHE_MS);

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
    playerId: intel.playerSlug || intel.playerId,
    timestamp: intel.reportedAt || intel.timestamp || intel.createdAt || new Date().toISOString(),
    text: intel.text || intel.detail || 'Insider tracking active.',
    ufProbability: uf,
  };
}

async function buildHighPriorityIntel(limit = 12) {
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

function clearHubCache() {
  hubCache.clear();
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
        const hit = await store.getPlayerBySlug(id);
        if (hit) return hit;
        const all = await store.getAllPlayers();
        return all.find((p) => p.slug === id || p.on3Id === id || p.name === id) || null;
      });

      if (!player) return res.status(404).json({ ok: false, error: 'Player not found' });
      return res.json({ ok: true, meta: hubMeta({ cacheKey }), player: mapPlayerToHub(player) });
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

  const { handleGetRecruitingMovementIntel } = require('../api/recruiting/movement-intel.ts');
  app.get('/api/recruiting/movement-intel', handleGetRecruitingMovementIntel);

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
}

module.exports = { mountRecruitingHubRoutes, buildClassPayload, mapPlayerToHub, clearHubCache, buildHighPriorityIntel };
