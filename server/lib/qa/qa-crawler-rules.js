/**
 * QA Crawler — Phase 2 rule analyzers (Blueprint Categories A–F).
 * Runs against fetch snapshots + local/API data.
 */
const fs = require('fs');
const path = require('path');
const config = require('./qa-config');
const { fetchJson, headUrl, check, moduleResult } = require('./qa-utils');
const { SITE_SECTIONS, RULE_CATALOG } = require('./qa-coverage-map');
const { readLocal } = require('./qa-section-checks');

const SERVER_ROOT = path.join(__dirname, '..', '..');

function loadJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8'));
  } catch {
    return null;
  }
}

function textSimilarity(a, b) {
  const wa = new Set(String(a || '').toLowerCase().split(/\s+/).filter(Boolean));
  const wb = new Set(String(b || '').toLowerCase().split(/\s+/).filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  wa.forEach((w) => {
    if (wb.has(w)) inter += 1;
  });
  return inter / Math.max(wa.size, wb.size);
}

function jaccardSimilarity(a, b) {
  const sa = new Set(String(a || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const sb = new Set(String(b || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((w) => {
    if (sb.has(w)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

/** A1 — overflow from hydrated snapshots */
function analyzeOverflow(snapshots) {
  const issues = [];
  snapshots
    .filter((s) => s.hydrated && s.dom?.overflow?.length)
    .forEach((snap) => {
      snap.dom.overflow.forEach((o) => {
        issues.push({
          ruleId: 'A1',
          checkId: 'crawler:overflow',
          sectionId: snap.sectionId,
          page: snap.page,
          selector: o.selector,
          domPath: o.selector,
          severity: o.type === 'horizontal' ? 'high' : 'medium',
          confidence: 90,
          message: `${o.type} overflow on ${o.selector} (Δ${o.deltaW || o.deltaH}px)`,
          recommendedFix: `Add overflow-y:auto or min-width:0 on ${o.selector}; verify modal flex scroll`,
          screenshotCrop: snap.screenshot
        });
      });
    });
  return issues;
}

/** A2 — layering / z-index overlaps */
function analyzeLayering(snapshots) {
  const issues = [];
  snapshots
    .filter((s) => s.hydrated && s.dom?.overlaps?.length)
    .forEach((snap) => {
      snap.dom.overlaps.slice(0, 5).forEach((o) => {
        issues.push({
          ruleId: 'A2',
          checkId: 'crawler:layering',
          sectionId: snap.sectionId,
          page: snap.page,
          selector: o.a,
          domPath: `${o.a} ∩ ${o.b}`,
          severity: 'high',
          confidence: 75,
          message: `Overlapping panels: ${o.a} and ${o.b}`,
          recommendedFix: 'Adjust z-index stack or panel layout so text is not covered',
          screenshotCrop: snap.screenshot
        });
      });
    });
  return issues;
}

/** A4 — mobile vs desktop divergence */
function analyzeViewportDivergence(snapshots) {
  const issues = [];
  const bySection = {};

  snapshots.filter((s) => s.hydrated).forEach((snap) => {
    bySection[snap.sectionId] = bySection[snap.sectionId] || {};
    bySection[snap.sectionId][snap.viewport] = snap;
  });

  Object.entries(bySection).forEach(([sectionId, vps]) => {
    const desk = vps.desktop;
    const mob = vps.mobile;
    if (!desk?.dom || !mob?.dom) return;

    (desk.dom.elements || []).forEach((dEl) => {
      const selector = dEl.selector;
      const mEl = mob.dom.elements.find((e) => e.selector === selector);
      if (!dEl || !mEl || !dEl.exists || !mEl.exists) return;

      const deskClip = dEl.clipped && !mEl.clipped;
      const mobClip = mEl.clipped && !dEl.clipped;
      if (deskClip || mobClip) {
        issues.push({
          ruleId: 'A4',
          checkId: 'crawler:viewport-divergence',
          sectionId,
          page: desk.page,
          selector,
          domPath: selector,
          severity: 'high',
          confidence: 85,
          message: deskClip
            ? `Desktop clipped but mobile fine on ${selector}`
            : `Mobile clipped but desktop fine on ${selector}`,
          recommendedFix: 'Align overflow/scroll rules across viewports in gv-team.css',
          screenshotCrop: deskClip ? desk.screenshot : mob.screenshot
        });
      }
    });
  });

  return issues;
}

/** B1 — missing selectors in snapshots */
function analyzeMissingContent(snapshots) {
  const issues = [];
  const hydrated = snapshots.filter((s) => s.hydrated);

  SITE_SECTIONS.filter((s) => s.selectors?.length).forEach((section) => {
    const snap = hydrated.find((s) => s.sectionId === section.id && s.viewport === 'desktop');
    if (!snap?.dom?.elements) return;

    snap.dom.elements.forEach((el) => {
      if (!el.exists) {
        issues.push({
          ruleId: 'B1',
          checkId: 'crawler:missing-content',
          sectionId: section.id,
          page: section.page || '/',
          selector: el.selector,
          domPath: el.domPath,
          severity: 'high',
          confidence: 95,
          message: `Missing required element ${el.selector} in ${section.label}`,
          recommendedFix: `Ensure ${el.selector} exists on React route ${section.page || '/vault'} — rebuild client export`,
          screenshotCrop: snap.screenshot
        });
      } else if (el.textLength === 0 && section.minTextLength?.[el.selector] !== 0) {
        const needsText = ['.gv-team-roster', '.gv-live-feed__list', '.gv-rh-grid'];
        if (needsText.includes(el.selector)) {
          issues.push({
            ruleId: 'B1',
            checkId: 'crawler:missing-content',
            sectionId: section.id,
            page: section.page || '/',
            selector: el.selector,
            domPath: el.domPath,
            severity: 'medium',
            confidence: 70,
            message: `Empty container ${el.selector} in ${section.label}`,
            recommendedFix: 'Verify data load hooks populate this section after hydration',
            screenshotCrop: snap.screenshot
          });
        }
      }
    });
  });

  return issues;
}

/** B2 — wrong ordering (React film hub + depth chart data) */
function analyzeWrongOrdering() {
  const issues = [];
  const filmSection = SITE_SECTIONS.find((s) => s.id === 'vault-film-room');
  if (filmSection?.expectedOrder) {
    const clientFilm = readLocal('../client/lib/film-room-api.ts') || readLocal('vault/film-room/index.html');
    filmSection.expectedOrder.forEach((hub, i) => {
      if (clientFilm && !clientFilm.includes(hub)) {
        issues.push({
          ruleId: 'B2',
          checkId: 'crawler:wrong-ordering',
          sectionId: 'vault-film-room',
          page: '/vault/film-room',
          selector: '.gv-film-hub-grid',
          domPath: 'film-hub-order',
          severity: 'medium',
          confidence: 85,
          message: `Film Room category "${hub}" missing from React hub order`,
          recommendedFix: 'Verify FILM_HUB_ORDER in client/lib/film-room-api.ts matches expected categories'
        });
      }
    });
  }

  const depthSrc =
    readLocal('../client/lib/depth-chart-data.ts') ||
    readLocal('data/roster/depth-chart.json') ||
    readLocal('vault/team/index.html');
  if (depthSrc && !depthSrc.includes('QB') && !depthSrc.includes('DEPTH_BY_PHASE')) {
    issues.push({
      ruleId: 'B2',
      checkId: 'crawler:wrong-ordering',
      sectionId: 'vault-team',
      page: '/vault/team',
      selector: '.gv-dc-grid',
      domPath: 'depth-chart-data',
      severity: 'medium',
      confidence: 80,
      message: 'Depth chart position data missing from React team module',
      recommendedFix: 'Verify DEPTH_BY_PHASE in client/lib/depth-chart-data.ts'
    });
  }

  return issues;
}

/** B3 / C4 — stale content */
async function analyzeStaleContent() {
  const issues = [];
  const now = Date.now();

  try {
    const { body } = await fetchJson(`${config.API_URL}/api/live/dashboard?limit=5`);
    const updatedAt = body.updatedAt ? new Date(body.updatedAt).getTime() : 0;
    if (updatedAt && now - updatedAt > 24 * 3600 * 1000) {
      issues.push({
        ruleId: 'B3',
        checkId: 'crawler:stale-content',
        sectionId: 'homepage',
        page: '/',
        selector: '.gv-live-feed__list',
        domPath: 'live-dashboard',
        severity: 'high',
        confidence: 90,
        message: `Live dashboard not updated in 24+ hours (${body.updatedAt})`,
        recommendedFix: 'Run live-aggregator ingest and verify feed-items.json refresh'
      });
    }
  } catch {
    /* api check module covers this */
  }

  const feed = loadJson('data/live/feed-items.json');
  const items = feed?.items || feed?.feed || [];
  if (items.length) {
    const newest = items
      .map((i) => new Date(i.createdAt || i.publishedAt || 0).getTime())
      .filter((t) => t > 0)
      .sort((a, b) => b - a)[0];
    const ageHours = newest ? (now - newest) / 3600000 : Infinity;
    const threshold = ageHours > 24 ? 24 : ageHours > 12 ? 12 : ageHours > 6 ? 6 : null;
    if (threshold) {
      issues.push({
        ruleId: 'C4',
        checkId: 'crawler:autoposter-stale',
        sectionId: 'homepage',
        page: '/',
        selector: '.gv-live-feed__list',
        domPath: 'autoposter-feed',
        severity: ageHours > 24 ? 'critical' : ageHours > 12 ? 'high' : 'medium',
        confidence: 88,
        message: `No autoposter activity in ${Math.round(ageHours)}h (threshold ${threshold}h)`,
        recommendedFix: 'Verify autoposter cron and live-ingest pipeline'
      });
    }
  }

  return issues;
}

/** C1/C2 — autoposter duplication & similarity */
function analyzeAutoposter(items) {
  const issues = [];
  const recent = (items || []).slice(0, 50);
  const seenText = new Map();

  recent.forEach((item, idx) => {
    const text = String(item.title || item.text || item.headline || '').trim();
    const norm = text.toLowerCase().replace(/\s+/g, ' ');
    if (norm.length < 12) return;

    if (seenText.has(norm)) {
      issues.push({
        ruleId: 'C1',
        checkId: 'crawler:autoposter-dup',
        sectionId: 'homepage',
        page: '/',
        selector: '.gv-live-feed__list',
        domPath: `feed-item-${idx}`,
        severity: 'high',
        confidence: 95,
        message: `Duplicate autoposter intel: "${text.slice(0, 60)}"`,
        recommendedFix: 'Dedup feed-items.json by normalized text hash before publish'
      });
    } else {
      seenText.forEach((prevIdx, prevText) => {
        const sim = Math.max(textSimilarity(norm, prevText), jaccardSimilarity(norm, prevText));
        if (sim > 0.85) {
          issues.push({
            ruleId: 'C2',
            checkId: 'crawler:autoposter-similarity',
            sectionId: 'homepage',
            page: '/',
            selector: '.gv-live-feed__list',
            domPath: `feed-item-${idx}`,
            severity: 'medium',
            confidence: Math.round(sim * 100),
            message: `Posts ${prevIdx} and ${idx} are ${Math.round(sim * 100)}% similar`,
            recommendedFix: 'Merge or skip near-duplicate autoposter entries within 6h window'
          });
        }
      });
      seenText.set(norm, idx);
    }
  });

  return issues.slice(0, 10);
}

/** C3 — UF-only filter */
function analyzeUfOnly(items) {
  const issues = [];
  const noise = /\b(Alabama|Ohio State|Michigan|Clemson|Texas A&M|national signing day noise)\b/i;
  const uf = /\b(Florida|Gators|UF\b|GatorVault)\b/i;

  (items || []).slice(0, 30).forEach((item, idx) => {
    const text = String(item.title || item.text || '');
    if (noise.test(text) && !uf.test(text)) {
      issues.push({
        ruleId: 'C3',
        checkId: 'crawler:uf-only',
        sectionId: 'homepage',
        page: '/',
        selector: '.gv-live-feed__list',
        domPath: `feed-item-${idx}`,
        severity: 'low',
        confidence: 70,
        message: `Non-UF intel detected: "${text.slice(0, 80)}"`,
        recommendedFix: 'Filter national noise from autoposter — UF/Gators keywords required'
      });
    }
  });

  return issues.slice(0, 5);
}

/** D1/D2 — recruiting & war room (API data only) */
async function analyzeRecruiting() {
  const issues = [];

  try {
    const { body } = await fetchJson(`${config.API_URL}/api/recruiting/board`);
    const players = body.players || body.items || [];
    const names = new Map();
    players.forEach((p, idx) => {
      const key = String(p.name || p.id || '').trim().toLowerCase();
      if (!key) return;
      if (names.has(key)) {
        issues.push({
          ruleId: 'D1',
          checkId: 'crawler:recruiting-mismatch',
          sectionId: 'vault-recruiting',
          page: '/vault/recruiting',
          selector: '.gv-rh-grid',
          domPath: `player-${idx}`,
          severity: 'high',
          confidence: 92,
          message: `Duplicate recruiting board player: ${p.name}`,
          recommendedFix: 'Dedup recruiting board JSON by player id/name'
        });
      } else names.set(key, idx);

      const stars = Number(p.stars);
      if (p.stars != null && (Number.isNaN(stars) || stars < 0 || stars > 5)) {
        issues.push({
          ruleId: 'D1',
          checkId: 'crawler:recruiting-mismatch',
          sectionId: 'vault-recruiting',
          page: '/vault/recruiting',
          selector: '.gv-rh-grid',
          domPath: `player-${p.name}`,
          severity: 'medium',
          confidence: 90,
          message: `Invalid ranking for ${p.name}: stars=${p.stars}`,
          recommendedFix: 'Fix stars field in recruiting board data (0–5)'
        });
      }
    });
  } catch {
    /* api module */
  }

  try {
    const { body } = await fetchJson(`${config.API_URL}/api/war-room/breakdowns`);
    const breakdowns = body.breakdowns || body.items || [];
    if (Array.isArray(breakdowns) && breakdowns.length === 0) {
      issues.push({
        ruleId: 'D2',
        checkId: 'crawler:war-room',
        sectionId: 'vault-recruiting',
        page: '/vault/recruiting',
        selector: '.gv-rh-scouting',
        domPath: 'scouting-tab',
        severity: 'low',
        confidence: 60,
        message: 'War Room / scouting breakdowns API returned zero items',
        recommendedFix: 'Populate war-room breakdowns for Recruiting Hub scouting tab'
      });
    }
  } catch {
    /* optional */
  }

  return issues;
}

/** E1/E2 — roster & depth chart (API + React data) */
async function analyzeTeamData() {
  const issues = [];

  try {
    const { body } = await fetchJson(`${config.API_URL}/api/roster/players`);
    const players = body.players || body.items || [];
    if (!players.length) {
      issues.push({
        ruleId: 'E1',
        checkId: 'crawler:roster-mismatch',
        sectionId: 'vault-team',
        page: '/vault/team',
        selector: '.gv-team-roster',
        domPath: 'roster-api',
        severity: 'high',
        confidence: 95,
        message: 'Roster API returned zero players',
        recommendedFix: 'Verify roster/players.json and /api/roster/players endpoint'
      });
    }
    players.slice(0, 50).forEach((p) => {
      if (p.number != null && (Number.isNaN(Number(p.number)) || Number(p.number) < 0 || Number(p.number) > 99)) {
        issues.push({
          ruleId: 'E1',
          checkId: 'crawler:roster-mismatch',
          sectionId: 'vault-team',
          page: '/vault/team',
          selector: '.gv-team-roster-row',
          domPath: `player-${p.name}`,
          severity: 'medium',
          confidence: 88,
          message: `Invalid jersey number for ${p.name}: ${p.number}`,
          recommendedFix: 'Fix roster number field (0–99)'
        });
      }
    });
  } catch {
    /* api module */
  }

  const depthSrc = readLocal('../client/lib/depth-chart-data.ts') || readLocal('vault/team/index.html');
  if (!depthSrc.includes('DEPTH_BY_PHASE') && !depthSrc.includes('gv-dc-grid')) {
    issues.push({
      ruleId: 'E2',
      checkId: 'crawler:depth-chart',
      sectionId: 'vault-team',
      page: '/vault/team',
      selector: '.gv-dc-grid',
      domPath: 'depth-chart-data',
      severity: 'medium',
      confidence: 75,
      message: 'React depth chart module markers missing',
      recommendedFix: 'Verify VaultTeamPage depth chart tab and DEPTH_BY_PHASE data'
    });
  }

  return issues.slice(0, 12);
}

/** F1/F2 — API latency & cache */
async function analyzeApiHealth() {
  const issues = [];
  const apiSection = SITE_SECTIONS.find((s) => s.id === 'api-health');
  const endpoints = apiSection?.endpoints || [];

  for (const ep of endpoints) {
    const url = `${config.API_URL}${ep.path}`;
    const t0 = Date.now();
    try {
      const { body } = await fetchJson(url, { timeout: 15000 });
      const ms = Date.now() - t0;
      if (ms >= 2000) {
        issues.push({
          ruleId: 'F1',
          checkId: 'crawler:api-latency',
          sectionId: 'api-health',
          page: null,
          selector: ep.path,
          domPath: ep.path,
          severity: 'critical',
          confidence: 98,
          message: `${ep.path} responded in ${ms}ms (≥2s)`,
          recommendedFix: 'Investigate Render cold start, cache warming, or DB query latency'
        });
      } else if (ms >= 1000) {
        issues.push({
          ruleId: 'F1',
          checkId: 'crawler:api-latency',
          sectionId: 'api-health',
          page: null,
          selector: ep.path,
          domPath: ep.path,
          severity: 'high',
          confidence: 95,
          message: `${ep.path} responded in ${ms}ms (≥1s)`,
          recommendedFix: 'Optimize API response time — add caching or reduce payload'
        });
      } else if (ms >= 500) {
        issues.push({
          ruleId: 'F1',
          checkId: 'crawler:api-latency',
          sectionId: 'api-health',
          page: null,
          selector: ep.path,
          domPath: ep.path,
          severity: 'medium',
          confidence: 90,
          message: `${ep.path} responded in ${ms}ms (≥500ms)`,
          recommendedFix: 'Monitor API latency trend — consider edge cache'
        });
      }

      if (ep.cacheMaxAgeSec && body?.updatedAt) {
        const ageSec = (Date.now() - new Date(body.updatedAt).getTime()) / 1000;
        if (ageSec > ep.cacheMaxAgeSec) {
          issues.push({
            ruleId: 'F2',
            checkId: 'crawler:cache-stale',
            sectionId: 'api-health',
            page: null,
            selector: ep.path,
            domPath: ep.path,
            severity: ageSec > ep.cacheMaxAgeSec * 3 ? 'high' : 'medium',
            confidence: 92,
            message: `${ep.path} cache age ${Math.round(ageSec)}s (max ${ep.cacheMaxAgeSec}s)`,
            recommendedFix: 'Trigger cache refresh cron or live-aggregator pipeline'
          });
        }
      }
    } catch (err) {
      issues.push({
        ruleId: 'F1',
        checkId: 'crawler:api-latency',
        sectionId: 'api-health',
        page: null,
        selector: ep.path,
        domPath: ep.path,
        severity: 'critical',
        confidence: 99,
        message: `${ep.path} unreachable: ${err.message}`,
        recommendedFix: 'Restore API endpoint health on Render'
      });
    }
  }

  return issues;
}

/** F3 — 404 asset detection (React exports only — no monolith CSS paths) */
async function analyze404Assets() {
  return require('../crawler/checks/crawler-404').analyze404Assets();
}

/** Pressers & highlights — React Film Room categories */
function analyzePressersHighlights() {
  const issues = [];
  const filmHtml =
    readLocal('vault/film-room/index.html') ||
    readLocal('../client/lib/film-room-api.ts') ||
    readLocal('index.html');

  if (!filmHtml.includes('UF Press Conferences') && !filmHtml.includes('Press Conferences')) {
    issues.push({
      ruleId: 'B1',
      checkId: 'crawler:pressers-missing',
      sectionId: 'vault-film-room',
      page: '/vault/film-room',
      selector: '.gv-film-hub-card',
      domPath: 'film-room-press-category',
      severity: 'high',
      confidence: 90,
      message: 'Press Conferences category missing from React Film Room hub',
      recommendedFix: 'Add UF Press Conferences to FILM_HUB_ORDER in VaultFilmRoomPage'
    });
  }

  if (!filmHtml.includes('Highlights') && !filmHtml.includes('gv-film-lesson')) {
    issues.push({
      ruleId: 'B1',
      checkId: 'crawler:highlights-missing',
      sectionId: 'vault-film-room',
      page: '/vault/film-room',
      selector: '.gv-film-lessons',
      domPath: 'film-room-highlights',
      severity: 'medium',
      confidence: 85,
      message: 'Highlights category missing from React Film Room',
      recommendedFix: 'Verify Film Room catalog includes Highlights hub category'
    });
  }

  return issues;
}

function ruleIssueToCheck(issue) {
  const rule = RULE_CATALOG[issue.ruleId] || {};
  return {
    id: issue.checkId || rule.id || `crawler:${issue.ruleId}`,
    module: 'crawler',
    label: issue.message,
    pass: false,
    error: issue.message,
    url: issue.page ? `${config.SITE_URL}${issue.page}` : null,
    repro: issue.recommendedFix,
    details: {
      ruleId: issue.ruleId,
      sectionId: issue.sectionId,
      selector: issue.selector,
      domPath: issue.domPath,
      screenshot: issue.screenshotCrop,
      severity: issue.severity,
      confidence: issue.confidence,
      category: rule.classification ? rule.classification.charAt(0).toUpperCase() : null
    }
  };
}

/**
 * Run all blueprint rules against fetch artifacts.
 */
async function analyzeSnapshots(fetchResult) {
  const { snapshots = [] } = fetchResult;
  const feed = loadJson('data/live/feed-items.json');
  const feedItems = feed?.items || feed?.feed || [];

  const rawIssues = [
    ...analyzeOverflow(snapshots),
    ...analyzeLayering(snapshots),
    ...analyzeViewportDivergence(snapshots),
    ...analyzeMissingContent(snapshots),
    ...analyzeWrongOrdering(),
    ...(await analyzeStaleContent()),
    ...analyzeAutoposter(feedItems),
    ...analyzeUfOnly(feedItems),
    ...(await analyzeRecruiting()),
    ...(await analyzeTeamData()),
    ...(await analyzeApiHealth()),
    ...(await analyze404Assets()),
    ...analyzePressersHighlights()
  ];

  // Dedupe by checkId + selector
  const seen = new Set();
  const unique = rawIssues.filter((i) => {
    const key = `${i.checkId}:${i.selector}:${i.message.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const failedChecks = unique.map(ruleIssueToCheck);
  const passChecks = Object.entries(RULE_CATALOG).map(([ruleId, rule]) => {
    const hit = unique.some((i) => i.ruleId === ruleId);
    if (hit) return null;
    return {
      id: rule.id,
      module: 'crawler',
      label: rule.name,
      pass: true,
      details: { ruleId, skipped: false }
    };
  }).filter(Boolean);

  return {
    issues: unique,
    checks: [...failedChecks, ...passChecks],
    module: moduleResult('crawler', [...failedChecks, ...passChecks])
  };
}

module.exports = {
  analyzeSnapshots,
  analyzeOverflow,
  analyzeLayering,
  analyzeViewportDivergence,
  analyzeMissingContent,
  analyzeWrongOrdering,
  analyzeStaleContent,
  analyzeAutoposter,
  analyzeRecruiting,
  analyzeTeamData,
  analyzeApiHealth,
  analyze404Assets,
  analyzePressersHighlights,
  ruleIssueToCheck
};
