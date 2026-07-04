/**
 * GatorVault Admin Hub ? aggregated API for the command center.
 */
const { buildOpsStatusReport } = require('./ops-status');
const opsAlerts = require('./ops-alerts');
const qaStore = require('./qa/qa-store');
const productStore = require('./product-intel/product-intel-store');
const selfRunnerEngine = require('./self-runner/self-runner-engine');
const recruitingStore = require('./recruiting-store');
const { loadPublishedArticles } = require('./content-store');
const { loadUsers } = require('./user-store');
const { verifyAdminPin, pinFromReq } = require('./admin-pin');

const MODULE_IDS = [
  'dashboard',
  'gm2',
  'product-intel',
  'qa',
  'recruiting',
  'team',
  'content',
  'community',
  'feedback',
  'settings',
  'player-intel',
  'self-runner'
];

function detectEnvironment() {
  const tag = String(process.env.GV_ENV || process.env.APP_ENV || '').toLowerCase();
  if (tag.includes('stage') || tag === 'staging') return 'stage';
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.NETLIFY === 'true'
  ) {
    return 'prod';
  }
  return 'stage';
}

function requireAdmin(req, res) {
  if (!verifyAdminPin(pinFromReq(req))) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

function hoursSince(iso) {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

function freshStatus(iso, warnH, critH) {
  const h = hoursSince(iso);
  if (h == null) return 'red';
  if (h <= warnH) return 'green';
  if (h <= critH) return 'yellow';
  return 'red';
}

function tileById(ops, id) {
  return (ops.tiles || []).find((t) => t.id === id) || null;
}

function summarizeQa() {
  const dash = qaStore.getDashboard();
  const last = dash.lastRun || (dash.recentRuns && dash.recentRuns[0]) || null;
  return {
    pass: last ? !!last.pass : null,
    failed: last ? (last.failed != null ? last.failed : last.summary && last.summary.failed) : null,
    lastRunAt: last && (last.at || last.finishedAt),
    dashboard: dash
  };
}

function summarizeProductIntel() {
  const doc = productStore.readDoc();
  const scores = productStore.getLatestScores(doc);
  const fixQueueOpen = (doc.fixQueue || []).filter((f) => !f.resolved).length;
  return {
    overall: scores && scores.overall != null ? scores.overall : null,
    fixQueueOpen,
    scores,
    todaySummary: productStore.getTodaySummary(doc)
  };
}

function buildPipelines(opsReport) {
  const p = opsReport.pipeline || {};
  const list = [];
  const push = (label, iso, summary, warn, crit) => {
    list.push({
      label,
      summary: summary || (iso ? 'Last run recorded' : 'No data'),
      status: freshStatus(iso, warn, crit)
    });
  };
  push(
    'Live hub refresh',
    p.lastLiveRefresh,
    p.lastLiveRefreshError ? String(p.lastLiveRefreshError) : null,
    2,
    6
  );
  push(
    'Beat intel pull',
    p.beatCache && p.beatCache.fetchedAt,
    p.beatCache && p.beatCache.error
      ? String(p.beatCache.error)
      : `${(p.beatCache && p.beatCache.postCount) || 0} posts cached`,
    6,
    24
  );
  push(
    'Recruiting ingest',
    p.on3Ingest && p.on3Ingest.lastRun,
    p.on3Ingest && p.on3Ingest.enabled ? 'ON3 ingest enabled' : 'Ingest idle',
    24,
    48
  );
  const ap = p.autoposter || {};
  push(
    'Autoposter queue',
    ap.lastSentAt || ap.lastRunAt,
    `${ap.queuePending || 0} pending in queue`,
    12,
    36
  );
  push(
    'Content publish',
    p.articles && p.articles.lastPublishedAt,
    `${(p.articles && p.articles.publishedCount) || 0} published articles`,
    72,
    168
  );
  return list;
}

function buildModuleHealthMap({ ops, qa, productIntel, selfRunner }) {
  const map = {};
  MODULE_IDS.forEach((id) => {
    map[id] = 'green';
  });

  map.dashboard = ops.overall || 'green';
  const identity = tileById(ops, 'identity-patterns');
  const gmTile = tileById(ops, 'cron-jobs');
  map.gm2 = (identity && identity.status) || (gmTile && gmTile.status) || map.dashboard;

  if (productIntel.fixQueueOpen > 0) {
    map['product-intel'] = productIntel.fixQueueOpen > 8 ? 'red' : 'yellow';
  }
  if (qa.pass === false) map.qa = 'red';
  else if (qa.failed > 0) map.qa = 'yellow';

  const rec = tileById(ops, 'recruiting-board');
  if (rec) map.recruiting = rec.status;
  const depth = tileById(ops, 'depth-gamezone');
  if (depth) map.team = depth.status;
  const film = tileById(ops, 'film-room');
  const insider = tileById(ops, 'insider-articles');
  if (film && insider) {
    map.content =
      film.status === 'red' || insider.status === 'red'
        ? 'red'
        : film.status === 'yellow' || insider.status === 'yellow'
          ? 'yellow'
          : 'green';
  } else if (film) {
    map.content = film.status;
  }

  map['self-runner'] =
    selfRunner.queue && selfRunner.queue.pending > 0
      ? 'yellow'
      : selfRunner.enabled === false
        ? 'yellow'
        : 'green';
  map['player-intel'] = map.recruiting;
  return map;
}

function buildTopIssues({ ops, qa, productIntel, selfRunner, alerts }) {
  const issues = [];
  if (qa.pass === false) {
    issues.push({
      severity: 'red',
      title: 'QA crawl failing',
      detail: `${qa.failed || 0} failed checks`,
      route: '#qa/monitor',
      actionType: 'qa-run',
      action: 'Run crawl'
    });
  }
  (ops.tiles || [])
    .filter((t) => t.status === 'red')
    .slice(0, 3)
    .forEach((t) => {
      issues.push({
        severity: 'red',
        title: t.label,
        detail: t.summary || 'Subsystem unhealthy',
        route: '#dashboard/ops'
      });
    });
  (alerts.alerts || []).slice(0, 3).forEach((a) => {
    issues.push({
      severity: a.severity === 'critical' || a.severity === 'error' ? 'red' : 'yellow',
      title: a.title || a.type || 'Ops alert',
      detail: a.message || ''
    });
  });
  if (selfRunner.queue && selfRunner.queue.pending > 0) {
    issues.push({
      severity: 'yellow',
      title: 'Self-Runner pending approval',
      detail: `${selfRunner.queue.pending} fix proposal(s)`,
      route: '#self-runner/pending'
    });
  }
  if (productIntel.fixQueueOpen >= 6) {
    issues.push({
      severity: productIntel.fixQueueOpen >= 12 ? 'red' : 'yellow',
      title: 'Product fix queue',
      detail: `${productIntel.fixQueueOpen} open items`,
      route: '#product-intel/health',
      actionType: 'pi-recompute',
      action: 'Recompute'
    });
  }
  return issues.slice(0, 5);
}

function buildRecommendedActions(ctx) {
  const actions = [];
  if (ctx.qa.pass === false) actions.push({ id: 'qa-run', label: 'Run QA crawl' });
  if ((ctx.productIntel.fixQueueOpen || 0) > 0) {
    actions.push({ id: 'pi-recompute', label: 'Recompute product scores' });
  }
  if ((ctx.selfRunner.eligibleOpenIssues || 0) > 0) {
    actions.push({ id: 'sr-generate', label: 'Generate Self-Runner proposals' });
  }
  actions.push({ id: 'hub-cache', label: 'Refresh live hub cache' });
  const rec = tileById(ctx.ops, 'recruiting-board');
  if (rec && rec.status !== 'green') {
    actions.push({ id: 'recruiting-ingest', label: 'Run recruiting ingest' });
  }
  return actions.slice(0, 6);
}

function searchPlayers(q, limit) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle || needle.length < 2) return [];
  return recruitingStore
    .getAllPlayers()
    .filter((p) => {
      const name = `${p.name || ''} ${p.fullName || ''} ${p.slug || ''}`.toLowerCase();
      return name.includes(needle) || String(p.id || '').includes(needle);
    })
    .slice(0, limit)
    .map((p) => ({
      id: p.id || p.slug,
      slug: p.slug,
      name: p.name || p.fullName,
      classYear: p.classYear || p.year,
      type: 'player'
    }));
}

function searchArticles(q, limit) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle || needle.length < 2) return [];
  let articles = [];
  try {
    articles = loadPublishedArticles() || [];
  } catch {
    articles = [];
  }
  return articles
    .filter((a) => {
      const blob = `${a.title || ''} ${a.slug || ''} ${a.id || ''}`.toLowerCase();
      return blob.includes(needle);
    })
    .slice(0, limit)
    .map((a) => ({ id: a.id, slug: a.slug, title: a.title, type: 'article' }));
}

function searchUsers(q, limit) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle || needle.length < 2) return [];
  let users = [];
  try {
    users = loadUsers() || [];
  } catch {
    users = [];
  }
  const list = Array.isArray(users) ? users : Object.values(users);
  return list
    .filter((u) => {
      const blob = `${u.email || ''} ${u.name || ''} ${u.id || ''}`.toLowerCase();
      return blob.includes(needle);
    })
    .slice(0, limit)
    .map((u) => ({ id: u.id, email: u.email, name: u.name, type: 'user' }));
}

async function buildOverviewPayload() {
  const ops = await buildOpsStatusReport({ evaluateAlerts: false });
  const qa = summarizeQa();
  const productIntel = summarizeProductIntel();
  const selfRunner = selfRunnerEngine.healthSummary();
  const alerts = opsAlerts.listAlerts({ limit: 20 });
  const moduleHealth = buildModuleHealthMap({ ops, qa, productIntel, selfRunner });
  let overall = ops.overall || 'green';
  Object.values(moduleHealth).forEach((st) => {
    if (st === 'red') overall = 'red';
    else if (st === 'yellow' && overall !== 'red') overall = 'yellow';
  });

  return {
    ok: true,
    environment: detectEnvironment(),
    overall,
    updatedAt: new Date().toISOString(),
    ops,
    qa,
    productIntel,
    selfRunner,
    alerts,
    topIssues: buildTopIssues({ ops, qa, productIntel, selfRunner, alerts }),
    moduleHealth,
    recommendedActions: buildRecommendedActions({ ops, qa, productIntel, selfRunner }),
    pipelines: buildPipelines(ops)
  };
}

function mountAdminHubRoutes(app) {
  app.get('/api/admin/hub/overview', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const payload = await buildOverviewPayload();
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/hub/module-health', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ops = await buildOpsStatusReport({ evaluateAlerts: false });
      const qa = summarizeQa();
      const productIntel = summarizeProductIntel();
      const selfRunner = selfRunnerEngine.healthSummary();
      const moduleHealth = buildModuleHealthMap({ ops, qa, productIntel, selfRunner });
      const alerts = opsAlerts.listAlerts({ limit: 50 });
      const alertCount = Array.isArray(alerts.alerts) ? alerts.alerts.length : 0;
      return res.status(200).json({
        ok: true,
        moduleHealth,
        modules: moduleHealth,
        environment: detectEnvironment(),
        alertCount,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/hub/search', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'q required' });
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '8'), 10) || 8, 25);
      return res.status(200).json({
        ok: true,
        q,
        results: {
          players: searchPlayers(q, limit),
          articles: searchArticles(q, limit),
          users: searchUsers(q, limit)
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = {
  mountAdminHubRoutes,
  detectEnvironment,
  MODULE_IDS,
  buildOverviewPayload,
  buildModuleHealthMap
};
