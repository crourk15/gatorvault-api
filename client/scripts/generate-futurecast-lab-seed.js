#!/usr/bin/env node
/**
 * Bake FutureCast Lab seed so /vault/futurecast/ never cold-loads into fc-elite-loading.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/futurecast-lab-seed.json');
const API = process.env.FC_SEED_API || 'https://gatorvault-api.onrender.com';

function fetchJson(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode + ' ' + url));
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
      reject(new Error('timeout ' + url));
    });
  });
}

async function fetchJsonRetry(url, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function emptyMovement() {
  return {
    classYear: 2027,
    updatedAt: new Date().toISOString(),
    movementHeatmap: { upCount: 0, downCount: 0, flatCount: 0 },
    heatmap: { buckets: [], windowDays: 7 },
    risers: [],
    fallers: [],
    highVolatility: [],
    stable: [],
    fitScoreLeaders: [],
    fitScoreRisks: [],
    alerts: [],
  };
}

function slimPlayer(p) {
  if (!p || !(p.slug || p.name)) return null;
  const slug = p.slug || String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: p.id || slug,
    slug,
    name: p.name,
    classYear: Number(p.classYear || 2027),
    position: p.position || p.pos || 'ATH',
    school: p.school ?? null,
    hometown: p.hometown ?? null,
    state: p.state ?? null,
    composite: Number(p.composite || p.rating || 0),
    stars: Number(p.stars || 0),
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    // Lab meter + HP cards read ufProbability; keep ufConfidence as a legacy alias.
    ufConfidence: p.ufConfidence ?? p.ufProbability ?? null,
    ufProbability: p.ufProbability ?? p.ufConfidence ?? null,
    ufProbabilitySource: p.ufProbabilitySource,
    ufProbabilityLabel: p.ufProbabilityLabel ?? null,
    ufProbabilityLowConfidence: p.ufProbabilityLowConfidence ?? false,
    ufRpmPct: p.ufRpmPct ?? null,
    fitScore: p.fitScore ?? null,
    staffConfidence: p.staffConfidence ?? 0,
    priorityScore: p.priorityScore ?? p.hotScore ?? null,
    trendDelta7d: p.trendDelta7d ?? p.delta7d ?? p.movementDelta ?? null,
    delta7d: p.delta7d ?? p.trendDelta7d ?? p.movementDelta ?? 0,
    movementDelta: p.movementDelta ?? p.delta7d ?? p.trendDelta7d ?? 0,
    volatility7d: Number(p.volatility7d || 0),
    priority: p.priority || 'medium',
    committedTo: p.committedTo ?? null,
    predictors: Array.isArray(p.predictors) ? p.predictors.slice(0, 3) : [],
    competingSchools: Array.isArray(p.competingSchools) ? p.competingSchools.slice(0, 4) : [],
  };
}

function slimMasterBoard(board) {
  const players = (board.players || []).map(slimPlayer).filter(Boolean);
  return {
    classYear: Number(board.classYear || 2027),
    updatedAt: board.updatedAt || new Date().toISOString(),
    movementHeatmap: board.movementHeatmap || { upCount: 0, downCount: 0, flatCount: 0 },
    heatmap: board.heatmap || { buckets: [], windowDays: 7 },
    ufConfidenceAverage: Number(board.ufConfidenceAverage || 0),
    confidenceSparkline: Array.isArray(board.confidenceSparkline)
      ? board.confidenceSparkline.slice(0, 12)
      : [],
    commitWatch: Array.isArray(board.commitWatch) ? board.commitWatch.slice(0, 8) : [],
    highPriority: {
      playerIds: board.highPriority?.playerIds || players.slice(0, 8).map((p) => p.id),
      players: (board.highPriority?.players || players.slice(0, 8)).map(slimPlayer).filter(Boolean),
    },
    movementSummary: board.movementSummary || {
      risers: [],
      fallers: [],
      highVolatility: [],
      riserPlayers: [],
      fallerPlayers: [],
      volatilePlayers: [],
    },
    players,
  };
}

function readExistingSeed() {
  try {
    if (!fs.existsSync(OUT)) return null;
    const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    if ((prev.masterBoard?.players || []).length >= 10) return prev;
  } catch (_) {}
  return null;
}

async function fromProd() {
  const [master, home, hp27, hp28, trending, movement] = await Promise.all([
    fetchJsonRetry(API + '/api/futurecast/master-board'),
    fetchJsonRetry(API + '/api/futurecast/home').catch(() => null),
    fetchJsonRetry(API + '/api/futurecast/high-priority?year=2027').catch(() => null),
    fetchJsonRetry(API + '/api/futurecast/high-priority?year=2028').catch(() => null),
    fetchJsonRetry(API + '/api/futurecast/trending').catch(() => null),
    fetchJsonRetry(API + '/api/futurecast/movement-intel').catch(() => null),
  ]);
  return { master, home, hp27, hp28, trending, movement, source: 'prod-api' };
}

function fromLocalPlayers() {
  const playersRaw = require(path.join(ROOT, 'server/data/recruiting/players.json'));
  const list = Array.isArray(playersRaw) ? playersRaw : playersRaw.players || [];
  const targets = list
    .filter((p) => Number(p.classYear || p.class_year || 0) === 2027)
    .filter((p) => !p.committedTo || /florida|gators/i.test(String(p.committedTo)))
    .slice(0, 40)
    .map((p) =>
      slimPlayer({
        ...p,
        classYear: 2027,
        ufConfidence: p.ufConfidence ?? p.ufProbability ?? 50,
        trendDelta7d: p.trendDelta7d ?? 0,
      })
    )
    .filter(Boolean);

  if (targets.length < 8) {
    // Broaden: any 2027 with rating
    list
      .filter((p) => Number(p.classYear || p.class_year || 0) === 2027)
      .slice(0, 40)
      .forEach((p) => {
        const row = slimPlayer({ ...p, classYear: 2027, ufConfidence: p.ufConfidence ?? 45 });
        if (row && !targets.find((t) => t.slug === row.slug)) targets.push(row);
      });
  }

  const master = slimMasterBoard({
    classYear: 2027,
    updatedAt: new Date().toISOString(),
    ufConfidenceAverage:
      targets.reduce((s, p) => s + (Number(p.ufConfidence) || 0), 0) / Math.max(targets.length, 1),
    players: targets,
    highPriority: { playerIds: targets.slice(0, 8).map((p) => p.id), players: targets.slice(0, 8) },
    commitWatch: [],
    movementHeatmap: { upCount: 0, downCount: 0, flatCount: targets.length },
    heatmap: { buckets: [], windowDays: 7 },
    confidenceSparkline: [],
    movementSummary: {
      risers: [],
      fallers: [],
      highVolatility: [],
      riserPlayers: [],
      fallerPlayers: [],
      volatilePlayers: [],
    },
  });

  return {
    master,
    home: {
      classYear: 2027,
      commitSort: 'fit',
      heatmap: master.heatmap,
      commits: [],
      topTargets: master.players.slice(0, 6),
      trendingUp: [],
      trendingDown: [],
      portalWatchlist: [],
    },
    hp27: { players: master.highPriority.players },
    hp28: { players: [] },
    trending: { classYear: 2027, updatedAt: master.updatedAt, trendingUp: [], trendingDown: [] },
    movement: emptyMovement(),
    source: 'local-players',
  };
}

function writePayload(pack) {
  const masterBoard = slimMasterBoard(pack.master || {});
  if (!masterBoard.players.length) {
    throw new Error('empty master board');
  }

  const homeRaw = pack.home || {};
  const home = {
    classYear: homeRaw.classYear || masterBoard.classYear,
    commitSort: homeRaw.commitSort || 'fit',
    heatmap: homeRaw.heatmap || masterBoard.heatmap,
    commits: [],
    topTargets: (homeRaw.topTargets || masterBoard.players.slice(0, 6))
      .map(slimPlayer)
      .filter(Boolean)
      .slice(0, 8),
    trendingUp: (homeRaw.trendingUp || []).map(slimPlayer).filter(Boolean).slice(0, 6),
    trendingDown: (homeRaw.trendingDown || []).map(slimPlayer).filter(Boolean).slice(0, 6),
    portalWatchlist: [],
  };

  const highPriority = (pack.hp28?.players || pack.hp27?.players || masterBoard.highPriority.players || [])
    .map(slimPlayer)
    .filter(Boolean)
    .slice(0, 16);
  const highPriorityClosing = (pack.hp27?.players || masterBoard.highPriority.players || [])
    .map(slimPlayer)
    .filter(Boolean)
    .slice(0, 16);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: pack.source,
    masterBoard,
    trendingBoard: pack.trending || {
      classYear: masterBoard.classYear,
      updatedAt: masterBoard.updatedAt,
      trendingUp: [],
      trendingDown: [],
    },
    movementIntel: pack.movement || emptyMovement(),
    staffNotes: {
      classYear: masterBoard.classYear,
      updatedAt: masterBoard.updatedAt,
      totalNotes: 0,
      count: 0,
      notes: [],
    },
    home,
    stock: { stockUp: [], stockDown: [], windowDays: 7 },
    summary: {
      classYear: masterBoard.classYear,
      commitCount: masterBoard.commitWatch.length,
      targetCount: masterBoard.players.length,
      nationalRank: null,
    },
    metrics: {
      // Discovery meter should seed from 2028 HP GV odds, not Closing Class master avg.
      avgUFProbability: (() => {
        const odds = highPriority
          .map((p) => Number(p.ufProbability ?? p.ufConfidence))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (odds.length) return Math.round(odds.reduce((a, b) => a + b, 0) / odds.length);
        return Math.round(masterBoard.ufConfidenceAverage || 0);
      })(),
      highPriorityCount: highPriority.length || masterBoard.highPriority.players.length,
      activePredictions: masterBoard.players.length,
    },
    heatLevel: 'warm',
    lastUpdated: masterBoard.updatedAt,
    highPriority,
    highPriorityClosing,
    visitIntel: pack.hp28?.visitIntel || pack.hp27?.visitIntel || [],
    visitRecap: pack.hp28?.visitRecap || pack.hp27?.visitRecap || [],
    flipWatch: pack.hp28?.flipWatch || pack.hp27?.flipWatch || [],
    movementNarratives: pack.hp28?.movementNarratives || pack.hp27?.movementNarratives || [],
    underclassmen: [],
    roster: [],
    commits2027: [],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  console.log(
    '[generate-futurecast-lab-seed] OK —',
    payload.source,
    'players',
    masterBoard.players.length,
    'hp',
    highPriority.length
  );
}

async function main() {
  try {
    const pack = await fromProd();
    writePayload(pack);
    return;
  } catch (err) {
    console.warn('[generate-futurecast-lab-seed] prod failed:', err.message);
  }

  const existing = readExistingSeed();
  if (existing) {
    existing.generatedAt = new Date().toISOString();
    existing.source = (existing.source || 'cached') + '+retained';
    fs.writeFileSync(OUT, JSON.stringify(existing) + '\n', 'utf8');
    console.log(
      '[generate-futurecast-lab-seed] OK — retained previous seed players',
      existing.masterBoard.players.length
    );
    return;
  }

  writePayload(fromLocalPlayers());
}

main().catch((err) => {
  console.error('[generate-futurecast-lab-seed] fatal:', err);
  process.exit(1);
});
