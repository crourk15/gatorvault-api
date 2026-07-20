#!/usr/bin/env node
/**
 * Bake NIL Elite seed so /vault/nil/ never cold-loads into nil-elite-loading skeletons.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/nil-hub-seed.json');
const API = process.env.NIL_SEED_API || 'https://gatorvault-api.onrender.com';

function fetchJson(url, timeoutMs = 35000) {
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

function slimProgram(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || row.school,
    school: row.school || row.name,
    conference: row.conference,
    collective: row.collective,
    ranking: row.ranking
      ? {
          secRank: row.ranking.secRank ?? null,
          nationalRank: row.ranking.nationalRank ?? null,
          score: row.ranking.score ?? null,
        }
      : null,
    metrics: row.metrics
      ? {
          estimatedAnnualPoolM: row.metrics.estimatedAnnualPoolM ?? null,
          trend: row.metrics.trend,
          trendPct: row.metrics.trendPct ?? null,
        }
      : null,
  };
}

function slimEvent(ev, idx) {
  return {
    id: ev.id || `ev-${idx}`,
    title: String(ev.title || ev.headline || 'NIL update').trim(),
    summary: ev.summary || ev.detail || undefined,
    impact: ev.impact || undefined,
    date: ev.date || undefined,
    type: ev.type || undefined,
    recruitingCorrelation: ev.recruitingCorrelation || undefined,
  };
}

function slimDashboard(dash) {
  const uf = dash.ufStanding || null;
  return {
    conference: dash.conference || 'SEC',
    ufStanding: uf
      ? {
          secRank: uf.secRank ?? null,
          nationalRank: uf.nationalRank ?? null,
          score: uf.score ?? null,
          estimatedAnnualPoolM: uf.estimatedAnnualPoolM ?? null,
          trend: uf.trend,
          trendPct: uf.trendPct ?? null,
          collective: uf.collective,
        }
      : null,
    secRankings: (dash.secRankings || []).map(slimProgram).filter(Boolean).slice(0, 16),
    nationalRankings: (dash.nationalRankings || []).map(slimProgram).filter(Boolean).slice(0, 28),
    trendHistory: (dash.trendHistory || []).slice(0, 8),
    positionImpact: (dash.positionImpact || []).slice(0, 8),
    recruitingCorrelation: dash.recruitingCorrelation || undefined,
    recentEvents: (dash.recentEvents || []).map(slimEvent).filter((e) => e.title).slice(0, 8),
    peers: (dash.peers || []).map(slimProgram).filter(Boolean).slice(0, 6),
    updatedAt: dash.updatedAt || new Date().toISOString(),
  };
}

function slimPlayer(p) {
  if (!p || !(p.slug || p.name)) return null;
  const slug = p.slug || String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: p.id || slug,
    slug,
    name: p.name,
    position: p.position || 'ATH',
    school: p.school ?? null,
    htWt: p.htWt ?? null,
    stars: p.stars ?? null,
    headliner: Boolean(p.headliner),
    committedTo: p.committedTo ?? null,
    compositeScore: Number(p.compositeScore || p.composite || 0),
    nationalRank: p.nationalRank ?? p.natlRank ?? null,
    positionRank: p.positionRank ?? p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.rating ?? null,
    natlRank: p.natlRank ?? p.nationalRank ?? null,
    posRank: p.posRank ?? p.positionRank ?? null,
    movementDelta: Number(p.movementDelta || 0),
    delta7d: Number(p.delta7d ?? p.movementDelta ?? 0),
    insiderNotes: null,
    notePreview: null,
    skinny: null,
    classYear: p.classYear ?? 2027,
  };
}

function fromLocalStore() {
  const nilStore = require(path.join(ROOT, 'server/lib/nil-store'));
  return slimDashboard(nilStore.buildDashboard({ conference: 'SEC', programId: nilStore.UF_ID }));
}

function retainPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  let dashboard = null;
  let players = [];
  let source = 'local-store';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = await fetchJsonRetry(API + '/api/nil/dashboard', 3);
      const dash = raw.dashboard || raw;
      if (dash && (dash.ufStanding || (dash.secRankings || []).length)) {
        dashboard = slimDashboard(dash);
        source = 'prod-dashboard';
        break;
      }
    } catch (err) {
      console.warn('[generate-nil-hub-seed] dashboard fetch failed:', err.message);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  try {
    const hp = await fetchJsonRetry(API + '/api/futurecast/high-priority', 3);
    players = (hp.players || []).map(slimPlayer).filter(Boolean).slice(0, 18);
    if (players.length && source === 'local-store') source = 'prod-high-priority+local-dashboard';
    if (players.length && source === 'prod-dashboard') source = 'prod-dashboard+high-priority';
  } catch (err) {
    console.warn('[generate-nil-hub-seed] high-priority fetch failed:', err.message);
  }

  if (!dashboard) {
    try {
      dashboard = fromLocalStore();
      source = players.length ? 'local-store+prod-players' : 'local-store';
    } catch (err) {
      console.warn('[generate-nil-hub-seed] local store failed:', err.message);
    }
  }

  const prev = retainPrevious();
  if (!dashboard && prev?.dashboard) {
    dashboard = prev.dashboard;
    source = 'retained-previous';
  }
  if (!players.length && Array.isArray(prev?.players) && prev.players.length) {
    players = prev.players;
    if (source === 'retained-previous') source = 'retained-previous';
    else source = source + '+retained-players';
  }

  if (!dashboard || !(dashboard.secRankings || []).length) {
    throw new Error('NIL seed has no dashboard rankings — refusing empty seed');
  }

  const seed = {
    generatedAt: new Date().toISOString(),
    source,
    dashboard,
    players,
  };

  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  console.log(
    '[generate-nil-hub-seed] wrote',
    OUT,
    'source=',
    source,
    'sec=',
    (dashboard.secRankings || []).length,
    'players=',
    players.length
  );
}

main().catch((err) => {
  console.error('[generate-nil-hub-seed] FATAL', err);
  process.exit(1);
});
