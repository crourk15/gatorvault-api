/**
 * Product Intelligence — Data Layer (Section 1 Layer 1).
 * Collects signals from QA, Live Dashboard, API health, autoposter, recruiting, team data.
 */
const fs = require('fs');
const path = require('path');
const config = require('../qa/qa-config');
const scoring = require('./product-intel-scoring');

const SERVER_ROOT = path.join(__dirname, '..', '..');

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8'));
  } catch {
    return null;
  }
}

async function timedFetch(url, opts = {}) {
  const t0 = Date.now();
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), opts.timeout || 15000) : null;
    const r = await fetch(url, { signal: controller?.signal, headers: opts.headers || {} });
    if (timer) clearTimeout(timer);
    const ms = Date.now() - t0;
    const body = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
    return { ok: r.ok, status: r.status, ms, body };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: err.message };
  }
}

/** Convert internal signal → fix-queue compatible failure object */
function signal(id, source, label, error, extra = {}) {
  return {
    id,
    module: extra.module || 'integrity',
    source,
    pass: false,
    label,
    error,
    repro: extra.repro || null,
    details: extra.details || null,
    classification: extra.classification || null,
    impact: extra.impact,
    confidence: extra.confidence
  };
}

async function collectApiHealthSignals() {
  const signals = [];
  const ping = await timedFetch(`${config.API_URL}/api/ping`);
  if (!ping.ok) {
    signals.push(
      signal('pi:api-latency:ping-fail', 'api-health', 'API ping failed', ping.error || `HTTP ${ping.status}`, {
        classification: 'api-latency',
        impact: 95,
        confidence: 98,
        repro: 'GET /api/ping on Render API'
      })
    );
  } else if (ping.ms >= 2000) {
    signals.push(
      signal('pi:api-latency:ping-2s', 'api-health', 'API ping >2s', `Ping ${ping.ms}ms`, {
        classification: 'api-latency',
        impact: 85,
        confidence: 95,
        details: [{ ms: ping.ms }]
      })
    );
  } else if (ping.ms >= 1000) {
    signals.push(
      signal('pi:api-latency:ping-1s', 'api-health', 'API ping >1s', `Ping ${ping.ms}ms`, {
        classification: 'api-latency',
        impact: 72,
        confidence: 90,
        details: [{ ms: ping.ms }]
      })
    );
  } else if (ping.ms >= 500) {
    signals.push(
      signal('pi:api-latency:ping-500ms', 'api-health', 'API ping >500ms', `Ping ${ping.ms}ms`, {
        classification: 'api-latency',
        impact: 55,
        confidence: 88,
        details: [{ ms: ping.ms }]
      })
    );
  }
  return signals;
}

async function collectCacheHealthSignals() {
  const signals = [];
  const health = await timedFetch(`${config.API_URL}/api/live/pipeline/health`);
  if (!health.ok || !health.body) return signals;

  const checks = health.body.checks || {};
  const stale = Object.entries(checks).filter(([k, v]) => k.endsWith('Stale') && v === true);
  if (stale.length) {
    signals.push(
      signal('pi:cache-stale:pipeline', 'cache-health', 'Live pipeline cache stale', `${stale.length} stale feed(s)`, {
        classification: 'cache-stale',
        impact: 75,
        confidence: 92,
        details: stale.map(([k]) => ({ feed: k })),
        repro: 'Check /api/live/pipeline/health stale flags'
      })
    );
  }

  const dash = await timedFetch(`${config.API_URL}/api/live/dashboard?limit=5`);
  if (dash.body?.cachedAt || dash.body?.generatedAt) {
    const ts = new Date(dash.body.cachedAt || dash.body.generatedAt).getTime();
    const ageSec = Math.round((Date.now() - ts) / 1000);
    if (ageSec > 45) {
      signals.push(
        signal('pi:cache-stale:dashboard', 'cache-health', 'Live Dashboard cache >45s', `Cache age ${ageSec}s`, {
          classification: 'cache-stale',
          impact: ageSec > 120 ? 80 : 65,
          confidence: 90,
          details: [{ ageSec }]
        })
      );
    }
  }
  return signals;
}

async function collectAutoposterSignals() {
  const signals = [];
  const feedPath = path.join(SERVER_ROOT, 'data', 'live', 'feed-items.json');
  let items = [];
  try {
    const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
    items = raw.items || raw.feed || (Array.isArray(raw) ? raw : []);
  } catch {
    return signals;
  }

  if (!items.length) {
    signals.push(
      signal('pi:autoposter-stale:empty', 'autoposter-logs', 'No feed items', 'Latest Updates feed empty', {
        classification: 'autoposter-stale',
        impact: 70,
        confidence: 85
      })
    );
    return signals;
  }

  const latest = items.reduce((best, item) => {
    const t = new Date(item.publishedAt || item.createdAt || item.ts || 0).getTime();
    return t > best ? t : best;
  }, 0);

  if (latest) {
    const hours = (Date.now() - latest) / 3600000;
    if (hours >= 24) {
      signals.push(
        signal('pi:autoposter-stale:24h', 'autoposter-logs', 'No posts in 24h', `Last post ${Math.round(hours)}h ago`, {
          classification: 'autoposter-stale',
          impact: 85,
          confidence: 90,
          ruleId: 'C4'
        })
      );
    } else if (hours >= 12) {
      signals.push(
        signal('pi:autoposter-stale:12h', 'autoposter-logs', 'No posts in 12h', `Last post ${Math.round(hours)}h ago`, {
          classification: 'autoposter-stale',
          impact: 72,
          confidence: 88
        })
      );
    } else if (hours >= 6) {
      signals.push(
        signal('pi:autoposter-stale:6h', 'autoposter-logs', 'No posts in 6h', `Last post ${Math.round(hours)}h ago`, {
          classification: 'autoposter-stale',
          impact: 58,
          confidence: 85
        })
      );
    }
  }

  const byPlayer = new Map();
  items.forEach((item, idx) => {
    const key = String(item.player || item.playerName || item.url || '').toLowerCase();
    if (!key) return;
    const t = new Date(item.publishedAt || item.createdAt || 0).getTime();
    const prev = byPlayer.get(key);
    if (prev && latest - t < 6 * 3600000) {
      signals.push(
        signal(`pi:autoposter-dup:player:${idx}`, 'autoposter-logs', 'Same player intel within 6h', key.slice(0, 60), {
          classification: 'autoposter-duplication',
          impact: 80,
          confidence: 85,
          details: [{ player: key, indices: [prev, idx] }]
        })
      );
    }
    byPlayer.set(key, idx);
  });

  return signals;
}

async function collectRecruitingSignals() {
  const signals = [];
  const board = await timedFetch(`${config.API_URL}/api/recruiting/board`);
  if (!board.ok) return signals;

  const players = board.body?.players || board.body?.items || [];
  const ids = new Set();
  const dups = [];
  players.forEach((p, idx) => {
    const key = p.id || p.slug || p.name;
    if (ids.has(key)) dups.push({ name: p.name, idx });
    else ids.add(key);
    const stars = Number(p.stars);
    if (p.stars != null && (Number.isNaN(stars) || stars < 0 || stars > 5)) {
      signals.push(
        signal(`pi:recruiting:stars:${idx}`, 'recruiting-board', 'Invalid star rating', `${p.name}: ${p.stars}`, {
          classification: 'recruiting-board-mismatch',
          impact: 70,
          confidence: 90
        })
      );
    }
    if (!p.name || !p.position) {
      signals.push(
        signal(`pi:recruiting:missing:${idx}`, 'recruiting-board', 'Recruit missing name/position', p.name || p.id || String(idx), {
          classification: 'recruiting-board-mismatch',
          impact: 65,
          confidence: 88
        })
      );
    }
  });

  if (dups.length) {
    signals.push(
      signal('pi:recruiting:duplicate', 'recruiting-board', 'Duplicate recruits on board', `${dups.length} duplicate(s)`, {
        classification: 'recruiting-board-mismatch',
        impact: 78,
        confidence: 92,
        details: dups.slice(0, 5)
      })
    );
  }
  return signals;
}

async function collectTeamDataSignals() {
  const signals = [];
  const roster = await timedFetch(`${config.API_URL}/api/roster/players`);
  if (roster.ok) {
    const players = roster.body?.players || roster.body?.items || [];
    const missingHeadshots = players.filter((p) => !p.headshot && !p.photo && !p.headshotUrl);
    const pct = players.length ? Math.round((missingHeadshots.length / players.length) * 100) : 0;
    if (players.length > 10 && pct > 80) {
      signals.push(
        signal('pi:roster:headshots', 'roster-depth-chart', 'Roster headshots mostly missing', `${pct}% missing headshots`, {
          classification: 'missing-image',
          impact: 55,
          confidence: 80,
          details: [{ total: players.length, missing: missingHeadshots.length }]
        })
      );
    }
    const noNumber = players.filter((p) => !p.number && !p.jersey);
    if (noNumber.length > players.length * 0.5 && players.length > 15) {
      signals.push(
        signal('pi:roster:numbers', 'roster-depth-chart', 'Roster missing jersey numbers', `${noNumber.length} players`, {
          classification: 'roster-mismatch',
          impact: 50,
          confidence: 75
        })
      );
    }
  }

  const meta = readJson('data/roster/depth-chart-meta.json');
  if (meta) {
    const positions = meta.positions || meta.units || [];
    if (Array.isArray(positions) && !positions.length) {
      signals.push(
        signal('pi:depth-chart:empty', 'roster-depth-chart', 'Depth chart positions empty', 'depth-chart-meta.json has no positions', {
          classification: 'depth-chart-mismatch',
          impact: 75,
          confidence: 90
        })
      );
    }
  }

  const staff = readJson('data/coaching-staff.json');
  if (staff) {
    const required = ['Jon Sumrall', 'Buster Faulkner', 'Brad White'];
    const names = (staff.coaches || []).map((c) => c.name);
    required.forEach((name) => {
      if (!names.some((n) => n && n.includes(name.split(' ')[1]))) {
        signals.push(
          signal(`pi:team:coach:${name}`, 'team-overview', `Missing coach: ${name}`, `${name} not in coaching-staff.json`, {
            classification: 'missing-content',
            impact: 70,
            confidence: 95
          })
        );
      }
    });
  }

  return signals;
}

async function collectFilmRoomSignals() {
  const signals = [];
  const html = fs.readFileSync(path.join(SERVER_ROOT, 'index.html'), 'utf8');
  const hubs = ['Offensive Scheme', 'Defensive Scheme', 'Film Breakdown', 'UF Press Conferences', 'Highlights'];
  const missing = hubs.filter((h) => !html.includes(h));
  if (missing.length) {
    signals.push(
      signal('pi:filmroom:categories', 'film-room', 'Film Room categories missing', missing.join(', '), {
        classification: 'filmroom-structure',
        impact: 75,
        confidence: 90
      })
    );
  }
  if (!html.includes('film-room-hub-landing')) {
    signals.push(
      signal('pi:filmroom:hub', 'film-room', 'Film Room hub landing missing', 'film-room-hub-landing not in index.html', {
        classification: 'filmroom-structure',
        impact: 72,
        confidence: 92
      })
    );
  }
  if (!html.includes('gvOpenFilmRoomHub')) {
    signals.push(
      signal('pi:filmroom:hook', 'film-room', 'Film Room hub hook missing', 'gvOpenFilmRoomHub not wired', {
        classification: 'filmroom-structure',
        impact: 70,
        confidence: 88
      })
    );
  }
  return signals;
}

function collectQaSignals(run) {
  if (!run?.modules && !run?.issues) return [];
  const fromChecks = run?.modules ? scoring.flattenChecks(run).filter((c) => !c.pass) : [];

  if (!run?.issues?.length) return fromChecks;

  const fromIssues = run.issues.map((issue) => ({
    id: issue.id,
    module: issue.module || 'crawler',
    source: 'qa-crawler',
    pass: false,
    label: issue.recommendedFix || issue.classification,
    error: issue.recommendedFix || issue.classification,
    repro: issue.recommendedFix,
    url: issue.page,
    classification: issue.classification,
    ruleId: issue.ruleId,
    details: {
      selector: issue.selector,
      domPath: issue.domPath,
      screenshot: issue.screenshotCrop,
      confidence: issue.confidence,
      severity: issue.severity,
      severityScore: issue.severityScore,
      sectionId: issue.sectionId
    }
  }));

  const seen = new Set(fromChecks.map((c) => c.id));
  return [...fromChecks, ...fromIssues.filter((i) => !seen.has(i.id))];
}

/**
 * Aggregate all data-layer signals. QA failures are included when run is provided.
 */
async function collectAllSignals(run = null) {
  const layers = {
    qa: run ? collectQaSignals(run) : [],
    apiHealth: await collectApiHealthSignals(),
    cacheHealth: await collectCacheHealthSignals(),
    autoposter: await collectAutoposterSignals(),
    recruiting: await collectRecruitingSignals(),
    teamData: await collectTeamDataSignals(),
    filmRoom: await collectFilmRoomSignals()
  };

  const all = [
    ...layers.qa,
    ...layers.apiHealth,
    ...layers.cacheHealth,
    ...layers.autoposter,
    ...layers.recruiting,
    ...layers.teamData,
    ...layers.filmRoom
  ];

  return {
    signals: all,
    layers,
    counts: {
      total: all.length,
      bySource: Object.fromEntries(
        Object.entries(layers).map(([k, v]) => [k, v.length])
      )
    }
  };
}

module.exports = {
  collectAllSignals,
  collectApiHealthSignals,
  collectCacheHealthSignals,
  collectAutoposterSignals,
  collectRecruitingSignals,
  collectTeamDataSignals,
  collectFilmRoomSignals,
  collectQaSignals
};
