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
const { loadUsers, changeUserEmail, findUserByEmail } = require('./user-store');
const { verifyAdminPin, pinFromReq } = require('./admin-pin');
const { hasPaidAccess, trialState, isSubscriptionActive } = require('./subscription-service');
const { effectiveTier } = require('./session-auth');

const MODULE_IDS = [
  'beat-desk',
  'dashboard',
  'members',
  'futurecast',
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
  'self-runner',
  'legacy'
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

const COMMAND_CENTER_ALERT_MAX_AGE_H = parseInt(
  process.env.HUB_TOP_ISSUE_ALERT_MAX_AGE_H || '48',
  10
);

function filterActionableAlerts(alertsDoc, qa) {
  const cutoff = Date.now() - COMMAND_CENTER_ALERT_MAX_AGE_H * 3600000;
  return (alertsDoc.alerts || []).filter((a) => {
    const at = new Date(a.at).getTime();
    if (!Number.isFinite(at) || at < cutoff) return false;
    const title = String(a.title || '');
    if (qa.pass === true && title.includes('QA Crawler FAILED')) return false;
    if (title.includes('QA Crawler recovered')) return false;
    return true;
  });
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

function summarizeAppStoreGate() {
  try {
    const gate = require('./app-store-stability-gate');
    const snap = gate.buildSnapshot({ healthReady: true });
    return {
      requiredDays: snap.requiredDays,
      piMin: snap.piMin,
      consecutiveGreenDays: snap.consecutiveGreenDays || 0,
      readyForSubmission: !!snap.readyForSubmission,
      windowStartedAt: snap.windowStartedAt,
      evaluation: snap.evaluation,
      sample: snap.sample,
      lastFailureReason: snap.lastFailureReason
    };
  } catch {
    return null;
  }
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

function worstStatus(a, b) {
  const rank = { red: 3, yellow: 2, unknown: 1, green: 0 };
  const ra = rank[a] != null ? rank[a] : 1;
  const rb = rank[b] != null ? rank[b] : 1;
  return ra >= rb ? a : b;
}

/**
 * Beat Desk sidebar health = "can Charles post?" — not full kitchen overall.
 * Wake-lag / latency-only API (ignore-ok) must not paint BD red/yellow.
 * Film Room / drafts / scorecard stay on Content / Product Health / Dashboard.
 */
function beatDeskModuleHealth(ops) {
  const api = tileById(ops, 'api-health');
  if (!api || !api.status) {
    return ops && ops.overall ? ops.overall : 'unknown';
  }
  try {
    const { enrichIssueFromTile } = require('./ops-fix-playbook');
    const issue = enrichIssueFromTile(api);
    if (issue && (issue.mode === 'ignore-ok' || (issue.coach && issue.coach.mode === 'ignore-ok'))) {
      return 'green';
    }
  } catch {
    /* playbook optional */
  }
  return api.status;
}

/** FutureCast desk health follows recruiting board — not Film Room catalog age. */
function futurecastModuleHealth(ops) {
  const rec = tileById(ops, 'recruiting-board');
  if (rec && rec.status) return rec.status;
  return ops && ops.overall ? ops.overall : 'unknown';
}

/** Never default green without a real signal — unchecked modules stay `unknown`. */
function buildModuleHealthMap({ ops, qa, productIntel, selfRunner, feedbackOpen, communityOpen }) {
  const map = {};
  MODULE_IDS.forEach((id) => {
    map[id] = 'unknown';
  });

  if (ops && ops.overall) {
    // Command Center / Dashboard keeps full kitchen truth.
    map.dashboard = ops.overall;
  }
  // Daily desks: stop Film Room / wake-lag from painting BD + FC red together.
  map['beat-desk'] = beatDeskModuleHealth(ops);
  map.futurecast = futurecastModuleHealth(ops);

  const identity = tileById(ops, 'identity-patterns');
  const gmTile = tileById(ops, 'cron-jobs');
  if (identity && identity.status) map.gm2 = identity.status;
  else if (gmTile && gmTile.status) map.gm2 = gmTile.status;
  else if (ops && ops.overall) map.gm2 = ops.overall;

  if (productIntel && productIntel.overall != null) {
    map['product-intel'] =
      productIntel.overall < 55 ? 'red' : productIntel.overall < 75 ? 'yellow' : 'green';
  }
  if (productIntel && productIntel.fixQueueOpen > 0) {
    const fixSt = productIntel.fixQueueOpen > 8 ? 'red' : 'yellow';
    map['product-intel'] = worstStatus(map['product-intel'], fixSt);
  }

  if (qa.pass === false) map.qa = 'red';
  else if (qa.pass === true && (qa.failed || 0) > 0) map.qa = 'yellow';
  else if (qa.pass === true) map.qa = 'green';

  const rec = tileById(ops, 'recruiting-board');
  if (rec && rec.status) map.recruiting = rec.status;
  const depth = tileById(ops, 'depth-gamezone');
  if (depth && depth.status) map.team = depth.status;
  const film = tileById(ops, 'film-room');
  const insider = tileById(ops, 'insider-articles');
  if (film && film.status && insider && insider.status) {
    map.content = worstStatus(film.status, insider.status);
  } else if (film && film.status) {
    map.content = film.status;
  } else if (insider && insider.status) {
    map.content = insider.status;
  }

  if (selfRunner) {
    if (selfRunner.queue && selfRunner.queue.pending > 0) map['self-runner'] = 'yellow';
    else if (selfRunner.enabled === false) map['self-runner'] = 'yellow';
    else if (selfRunner.enabled === true) map['self-runner'] = 'green';
  }

  if (typeof communityOpen === 'number') {
    map.community = communityOpen > 20 ? 'red' : communityOpen > 0 ? 'yellow' : 'green';
  }
  if (typeof feedbackOpen === 'number') {
    map.feedback = feedbackOpen > 10 ? 'red' : feedbackOpen > 0 ? 'yellow' : 'green';
  }

  // Settings has no live probe yet — leave unknown (not fake-green).
  map['player-intel'] = map.recruiting !== 'unknown' ? map.recruiting : 'unknown';
  // Legacy group mirrors the worst of its escape-hatch modules when known.
  map.legacy = worstStatus(
    worstStatus(map.content, map.community),
    worstStatus(map.feedback, map['self-runner'])
  );
  return map;
}

function buildTopIssues({ ops, qa, productIntel, selfRunner, alerts, appStoreGate }) {
  const {
    enrichIssueFromTile,
    enrichAppStoreGateIssue,
    enrichQaIssue,
    coachFromParts,
  } = require('./ops-fix-playbook');
  const issues = [];
  const qaIssue = enrichQaIssue(qa);
  if (qaIssue) issues.push(qaIssue);
  (ops.tiles || [])
    .filter((t) => t.status === 'red')
    .slice(0, 3)
    .forEach((t) => {
      issues.push(enrichIssueFromTile(t));
    });
  filterActionableAlerts(alerts, qa)
    .slice(0, 3)
    .forEach((a) => {
    issues.push({
      severity: a.severity === 'critical' || a.severity === 'error' ? 'red' : 'yellow',
      title: a.title || a.type || 'Ops alert',
      detail: a.message || '',
      why: a.message || a.title || 'Ops alert needs a look.',
      fixHowTo: 'Open Alerts / Full Ops logs for this item. If a red tile Fix button exists, use that first.',
      coach: coachFromParts({
        title: a.title || 'Ops alert',
        why: a.message || 'Something in ops needs attention.',
        howTo: 'Open the Alerts panel (bell) and read the newest matching alert.',
        steps: ['Open Alerts', 'If a red module tile matches, use its orange Fix button', 'Refresh after the job finishes'],
        dontWorry: 'Alerts pile up — fix the red tile first, not every gray notice.',
      }),
    });
  });
  if (selfRunner.queue && selfRunner.queue.pending > 0) {
    issues.push({
      severity: 'yellow',
      title: 'Self-Runner pending approval',
      detail: `${selfRunner.queue.pending} fix proposal(s)`,
      route: '#self-runner/pending',
      why: 'Self-Runner drafted fix proposals waiting for a human click.',
      fixHowTo: 'Open Self-Runner pending. Only approve if you understand the change — or leave for later.',
      coach: coachFromParts({
        title: 'Self-Runner',
        why: 'The bot wrote suggested code/content fixes. They do nothing until approved.',
        howTo: 'Open Self-Runner pending when you have time. Skip during daily posting.',
        steps: ['Finish Beat Desk posts first', 'Open Self-Runner only if you are reviewing fixes'],
        dontWorry: 'Pending proposals are not fires.',
      }),
    });
  }
  if (productIntel.fixQueueOpen >= 6) {
    issues.push({
      severity: productIntel.fixQueueOpen >= 12 ? 'red' : 'yellow',
      title: 'Product fix queue',
      detail: `${productIntel.fixQueueOpen} open items`,
      route: '#product-intel/health',
      actionType: 'pi-recompute',
      action: 'Recompute',
      why: 'Product Health has a backlog of open fix items.',
      fixHowTo: 'Open Product Health and Recompute. Work the queue when you are not mid-posting.',
      coach: coachFromParts({
        title: 'Product fix queue',
        why: 'The vault site scorecard has several open fix items.',
        howTo: 'Click Recompute, then open Product Health when you have a quiet minute.',
        steps: ['Recompute scores', 'Open Product Health', 'Ask support before changing code-level items'],
        dontWorry: 'You can still post on Beat Desk with a yellow queue.',
      }),
    });
  }
  const gateIssue = enrichAppStoreGateIssue(appStoreGate);
  // Score-only / ignore-ok gate is kept for strip context, but coach/fixer skip it.
  if (gateIssue) issues.push(gateIssue);
  // Prefer actionable issues first; bury ignore-ok at the end.
  issues.sort((a, b) => {
    const ai = a?.mode === 'ignore-ok' || a?.coach?.mode === 'ignore-ok' ? 1 : 0;
    const bi = b?.mode === 'ignore-ok' || b?.coach?.mode === 'ignore-ok' ? 1 : 0;
    if (ai !== bi) return ai - bi;
    const ar = a?.severity === 'red' ? 0 : 1;
    const br = b?.severity === 'red' ? 0 : 1;
    return ar - br;
  });
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
  const film = tileById(ctx.ops, 'film-room');
  if (film && film.status === 'red') {
    actions.unshift({ id: 'film-room-weekly', label: 'Rebuild Film Room catalog' });
  }
  const apiTile = tileById(ctx.ops, 'api-health');
  const apiRed = apiTile && apiTile.status === 'red';
  const gate = ctx.appStoreGate;
  // Never lead with Recompute for score-only gate — that traps Charles in a Command Center loop.
  if (gate && gate.evaluation && !gate.evaluation.green && !apiRed) {
    const reasons = gate.evaluation.reasons || [];
    if (reasons.includes('qa_crawl_failed') || reasons.includes('crawler_failures') || reasons.includes('api_failures')) {
      actions.unshift({ id: 'qa-run', label: 'Run QA crawl' });
    }
    // product_intel_below_90 alone: omit Recompute from recommended lead actions
  }
  return actions.slice(0, 6);
}

async function searchPlayers(q, limit) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle || needle.length < 2) return [];
  let players = [];
  try {
    players = (await recruitingStore.getAllPlayers()) || [];
  } catch {
    players = [];
  }
  if (!Array.isArray(players)) players = [];
  return players
    .filter((p) => {
      const name = `${p.name || ''} ${p.fullName || ''} ${p.slug || ''}`.toLowerCase();
      return name.includes(needle) || String(p.id || '').includes(needle);
    })
    .slice(0, limit)
    .map((p) => {
      const slug = p.slug || p.id;
      const title = p.name || p.fullName || slug;
      const year = p.classYear || p.year;
      return {
        id: p.id || slug,
        slug,
        name: title,
        title,
        classYear: year,
        subtitle: year ? `Class of ${year}` : 'Player',
        type: 'player',
        route: '#player-intel/entry',
        href: slug ? `/vault/recruiting/player/${encodeURIComponent(slug)}` : ''
      };
    });
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
    .map((a) => {
      const id = a.id || a.slug;
      return {
        id,
        slug: a.slug,
        title: a.title || id,
        subtitle: 'Insider article',
        type: 'article',
        route: '#content/insider-articles',
        href: id ? `/vault/articles/${encodeURIComponent(id)}` : '/vault/articles/'
      };
    });
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
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      title: u.name || u.email || u.id,
      subtitle: u.email || 'Member',
      type: 'user',
      route: '#members/recent',
      href: ''
    }));
}

function parseSinceMs(sinceRaw) {
  const since = String(sinceRaw || '30d').trim().toLowerCase();
  if (since === 'all' || since === '0' || since === '0d') return null;
  const m = since.match(/^(\d+)\s*d$/);
  if (m) {
    const days = Math.min(Math.max(parseInt(m[1], 10) || 30, 1), 3650);
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }
  const ts = Date.parse(since);
  return Number.isFinite(ts) ? ts : Date.now() - 30 * 24 * 60 * 60 * 1000;
}

function memberAccessBucket(user) {
  const paid = hasPaidAccess(user);
  const trial = trialState(user);
  if (paid) return 'paid';
  if (!trial.expired) return 'trial';
  return 'expired';
}

function memberBillingSource(user) {
  const source = String(user?.subscription?.source || '').toLowerCase();
  if (source) return source;
  if (user?.stripeCustomerId || user?.subscription?.stripeCustomerId) return 'stripe';
  return null;
}

function toSafeMemberRow(user) {
  const trial = trialState(user);
  const paid = hasPaidAccess(user);
  const accessActive = paid || !trial.expired;
  const sub = user?.subscription || null;
  const { sanitizeFirstTouch, outletLabel } = require('./member-attribution');
  const firstTouch = sanitizeFirstTouch(user?.firstTouch || null);
  return {
    email: user.email || null,
    name: user.name || null,
    createdAt: user.createdAt || null,
    trialEnd: trial.trialEndISO,
    trialDaysLeft: trial.daysLeft,
    tier: effectiveTier(user || {}),
    paid,
    accessActive,
    access: memberAccessBucket(user),
    subscriptionActive: isSubscriptionActive(user),
    billingSource: memberBillingSource(user),
    subscriptionStatus: sub?.status || null,
    subscriptionTier: sub?.tier || null,
    hasStripe: Boolean(user?.stripeCustomerId || sub?.stripeCustomerId),
    hasBeehiiv: Boolean(user?.beehiivSubscriptionId),
    onboardingSent: Boolean(user?.onboardingSent),
    firstTouch,
    source: outletLabel(firstTouch),
    campaign: firstTouch?.campaign || null,
    medium: firstTouch?.medium || null,
  };
}

/**
 * Newest members first. Never returns passwordHash or secrets.
 * @param {{ limit?: number, since?: string|null, access?: string }} opts
 */
function listRecentMembers(opts = {}) {
  const limit = Math.min(Math.max(parseInt(String(opts.limit ?? 50), 10) || 50, 1), 200);
  const sinceMs = parseSinceMs(opts.since == null ? '30d' : opts.since);
  const accessFilter = String(opts.access || 'all').trim().toLowerCase();
  let users = [];
  try {
    users = loadUsers() || [];
  } catch {
    users = [];
  }
  const list = Array.isArray(users) ? users : Object.values(users);
  const filtered = list
    .filter((u) => u && (u.email || u.name))
    .filter((u) => {
      if (sinceMs == null) return true;
      const created = Date.parse(u.createdAt || '');
      if (!Number.isFinite(created)) return false;
      return created >= sinceMs;
    })
    .map((u) => toSafeMemberRow(u))
    .filter((row) => {
      if (!accessFilter || accessFilter === 'all') return true;
      return row.access === accessFilter;
    })
    .sort((a, b) => {
      const am = Date.parse(a.createdAt || '') || 0;
      const bm = Date.parse(b.createdAt || '') || 0;
      return bm - am;
    });

  const counts = { all: 0, trial: 0, paid: 0, expired: 0 };
  for (const row of filtered) {
    counts.all += 1;
    if (counts[row.access] != null) counts[row.access] += 1;
  }

  const { countBySource } = require('./member-attribution');
  const bySource = countBySource(filtered);

  return {
    members: filtered.slice(0, limit),
    total: filtered.length,
    returned: Math.min(filtered.length, limit),
    counts,
    bySource,
    since: opts.since == null ? '30d' : String(opts.since),
    access: accessFilter || 'all',
    limit
  };
}

function countOpenFeedback() {
  try {
    const feedback = require('./feedback-store');
    const items = feedback.listSubmissions({ limit: 200 }) || [];
    return items.filter((row) => {
      const st = String(row.status || 'open').toLowerCase();
      return st !== 'closed' && st !== 'resolved' && st !== 'done';
    }).length;
  } catch {
    return null;
  }
}

function countOpenCommunityFlags() {
  try {
    const community = require('./community-store');
    if (typeof community.getOpenFlags === 'function') {
      return community.getOpenFlags().length;
    }
    return null;
  } catch {
    return null;
  }
}

function moduleHealthContext(ops, qa, productIntel, selfRunner) {
  const feedbackOpen = countOpenFeedback();
  const communityOpen = countOpenCommunityFlags();
  return buildModuleHealthMap({
    ops,
    qa,
    productIntel,
    selfRunner,
    feedbackOpen: feedbackOpen == null ? undefined : feedbackOpen,
    communityOpen: communityOpen == null ? undefined : communityOpen
  });
}

async function buildOverviewPayload() {
  const ops = await buildOpsStatusReport({ evaluateAlerts: false });
  const qa = summarizeQa();
  const productIntel = summarizeProductIntel();
  const selfRunner = selfRunnerEngine.healthSummary();
  const appStoreGate = summarizeAppStoreGate();
  const alerts = opsAlerts.listAlerts({ limit: 20 });
  const moduleHealth = moduleHealthContext(ops, qa, productIntel, selfRunner);
  let overall = ops.overall || 'unknown';
  Object.values(moduleHealth).forEach((st) => {
    if (st === 'red') overall = 'red';
    else if (st === 'yellow' && overall !== 'red') overall = 'yellow';
    else if (st === 'green' && overall === 'unknown') overall = 'green';
  });
  if (appStoreGate?.evaluation && !appStoreGate.evaluation.green && overall !== 'red') {
    overall = 'yellow';
  }

  return {
    ok: true,
    environment: detectEnvironment(),
    overall,
    updatedAt: new Date().toISOString(),
    ops,
    qa,
    productIntel,
    selfRunner,
    appStoreGate,
    alerts,
    topIssues: buildTopIssues({ ops, qa, productIntel, selfRunner, alerts, appStoreGate }),
    moduleHealth,
    recommendedActions: buildRecommendedActions({ ops, qa, productIntel, selfRunner, appStoreGate }),
    pipelines: buildPipelines(ops)
  };
}

function mountAdminHubRoutes(app) {
  app.get('/api/admin/hub/overview', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      try {
        const { isStayGreen } = require('./api-stay-green');
        if (isStayGreen()) {
          return res.status(200).json({
            ok: true,
            stayGreen: true,
            environment: detectEnvironment(),
            topIssues: [],
            recommendedActions: [
              {
                id: 'stay-green',
                title: 'API stay-green lockdown active',
                detail: 'Heavy cron/hub work is soft-skipped (API_STAY_GREEN). Set API_STAY_GREEN=false or API_STAY_GREEN_ALLOW_HEAVY=true to resume.',
                severity: 'info',
              },
            ],
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        /* optional */
      }
      const payload = await buildOverviewPayload();
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/hub/module-health', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      try {
        const { isStayGreen } = require('./api-stay-green');
        if (isStayGreen()) {
          const light = {
            api: { status: 'ok', detail: 'stay-green lockdown — login path prioritized' },
            auth: { status: 'ok' },
            recruiting: { status: 'paused', detail: 'heavy refresh soft-skipped' },
            live: { status: 'paused', detail: 'beat pull soft-skipped' },
          };
          return res.status(200).json({
            ok: true,
            stayGreen: true,
            moduleHealth: light,
            modules: light,
            environment: detectEnvironment(),
            alertCount: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        /* optional */
      }
      const ops = await buildOpsStatusReport({ evaluateAlerts: false });
      const qa = summarizeQa();
      const productIntel = summarizeProductIntel();
      const selfRunner = selfRunnerEngine.healthSummary();
      const moduleHealth = moduleHealthContext(ops, qa, productIntel, selfRunner);
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

  app.get('/api/admin/hub/search', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'q required' });
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '8'), 10) || 8, 25);
      const players = await searchPlayers(q, limit);
      return res.status(200).json({
        ok: true,
        q,
        results: {
          players,
          articles: searchArticles(q, limit),
          users: searchUsers(q, limit)
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Newest signups — Admin Hub only; safe fields (no passwordHash). */
  app.get('/api/admin/members/recent', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const payload = listRecentMembers({
        limit: req.query.limit,
        since: req.query.since,
        access: req.query.access
      });
      return res.status(200).json({
        ok: true,
        updatedAt: new Date().toISOString(),
        ...payload
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Fix a member typo email (e.g. outlook.coom → outlook.com).
   * Body: { from, to }
   * Caller can POST /api/welcome afterward to redeliver.
   */
  app.post('/api/admin/members/change-email', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const from = String(req.body?.from || req.body?.fromEmail || '').trim().toLowerCase();
      const to = String(req.body?.to || req.body?.toEmail || '').trim().toLowerCase();
      const result = changeUserEmail(from, to);
      if (!result.ok) {
        const status = result.error === 'account_not_found' ? 404 : 400;
        return res.status(status).json({ ok: false, error: result.error });
      }
      const safeUser = findUserByEmail(to);
      return res.status(200).json({
        ok: true,
        from: result.from,
        to: result.to,
        email: safeUser?.email || to,
        name: safeUser?.name || result.user?.name || null,
        previousEmails: Array.isArray(safeUser?.previousEmails) ? safeUser.previousEmails : [],
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** FutureCast targeting + admin allowlist control surface. */
  app.get('/api/admin/hub/futurecast', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fc = require('./admin-hub-futurecast');
      return res.status(200).json(fc.buildFutureCastHubSummary());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/hub/allowlist/add', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fc = require('./admin-hub-futurecast');
      const result = fc.addAllowlistTarget({
        slug: req.body?.slug,
        name: req.body?.name,
        classYear: req.body?.classYear || 2028,
      });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/hub/allowlist/remove', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const fc = require('./admin-hub-futurecast');
      const result = fc.removeAllowlistTarget({
        slug: req.body?.slug,
        classYear: req.body?.classYear || 2028,
      });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /** Purge UF staff coach phantoms soft-created as FutureCast/HS recruits. */
  app.post('/api/admin/hub/purge-staff-phantoms', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { purgeStaffPhantomRecruits } = require('./purge-staff-phantom-recruits');
      const report = await purgeStaffPhantomRecruits({ clearHubCache: true });
      return res.status(200).json({ ok: true, ...report });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Purge UF alumni / roster / empty-ATH phantoms off 2028 Priority Chase. */
  app.post('/api/admin/hub/purge-alumni-phantoms', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { purgeAlumniPhantomRecruits } = require('./purge-alumni-phantom-recruits');
      const report = await purgeAlumniPhantomRecruits({ clearHubCache: true });
      return res.status(200).json({ ok: true, ...report });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Repair jamarcus-johnson / Kamarion collision; seed real 2028 DL Jamarcus. */
  app.post('/api/admin/hub/repair-jamarcus-kamarion', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { repairJamarcusKamarionCollision } = require('./fix-jamarcus-kamarion-collision');
      const report = await repairJamarcusKamarionCollision();
      return res.status(200).json(report);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Delete prepared-meal stamp(s) so next full-profile rebuilds from live store. */
  app.post('/api/admin/hub/purge-profile-stamps', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const stampStore = require('./player-profile-stamp');
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const slugs = Array.isArray(body.slugs)
        ? body.slugs
        : String(body.slug || req.query.slug || '')
            .split(',')
            .map((s) => String(s || '').trim().toLowerCase())
            .filter(Boolean);
      if (!slugs.length) {
        return res.status(400).json({ ok: false, error: 'slug_or_slugs_required' });
      }
      const results = slugs.map((slug) => ({ slug, ...stampStore.deleteStamp(slug) }));
      return res.status(200).json({ ok: true, results });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Curated Hudl/On3 film traits for Beat Desk Copy Brief. */
  app.get('/api/admin/hub/film-traits', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const store = require('./film-traits-store');
      return res.status(200).json({ ok: true, items: store.listFilmTraits() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/hub/film-traits/:slug', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const store = require('./film-traits-store');
      const entry = store.getFilmTraitsBySlug(req.params.slug);
      if (!entry) return res.status(404).json({ ok: false, error: 'not_found' });
      return res.status(200).json({ ok: true, filmTraits: entry });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/hub/film-traits', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const store = require('./film-traits-store');
      const body = req.body || {};
      const entry = store.upsertFilmTraits(body.slug || body.playerSlug, body);
      return res.status(200).json({ ok: true, filmTraits: entry });
    } catch (err) {
      const code = err.statusCode || 400;
      return res.status(code).json({ ok: false, error: err.message });
    }
  });

  /** Pull On3/Hudl highlight URLs into film-traits (single slug or batch). */
  app.post('/api/admin/hub/film-traits/hydrate', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ingest = require('./film-traits-ingest');
      const body = req.body || {};
      const force = body.force === true;

      if (Array.isArray(body.slugs) && body.slugs.length) {
        const items = body.slugs.map((s) =>
          typeof s === 'string' ? { slug: s } : { slug: s.slug || s.playerSlug, playerName: s.name || s.playerName, classYear: s.classYear }
        );
        const out = await ingest.hydrateFilmTraitsBatch(items, {
          concurrency: Math.min(Number(body.concurrency) || 2, 4),
          force,
        });
        return res.status(200).json(out);
      }

      const slug = body.slug || body.playerSlug || req.query?.slug;
      if (!slug) {
        return res.status(400).json({ ok: false, error: 'slug or slugs[] required' });
      }
      const out = await ingest.hydrateFilmTraitsFromOn3({
        slug,
        playerName: body.playerName || body.name,
        classYear: body.classYear,
        force,
        dryRun: body.dryRun === true,
      });
      return res.status(out.ok ? 200 : 502).json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** AI-evaluate film traits for a slug (Vault scout — Charles does not write traits). */
  app.post('/api/admin/hub/film-traits/evaluate', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ai = require('./film-traits-ai-eval');
      const body = req.body || {};
      const slug = body.slug || body.playerSlug;
      if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
      const out = await ai.evaluateFilmTraitsForSlug(slug, { force: body.force !== false });
      return res.status(out.ok ? 200 : 502).json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Hydrate film for current Beat Desk inbox recruit slugs. */
  app.post('/api/admin/hub/film-traits/hydrate-desk', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const ingest = require('./film-traits-ingest');
      const { getIntelInbox } = require('./post-studio-intel-inbox');
      const limit = Math.min(Number(req.body?.limit) || 40, 80);
      const inbox = await getIntelInbox({ deskMode: true, limit });
      const items = (inbox?.items || [])
        .map((it) => ({
          slug: it.slug || it.playerSlug,
          playerName: it.playerName || it.name,
          classYear: it.classYear || it.year || 2028,
        }))
        .filter((it) => it.slug && !String(it.slug).startsWith('hub-') && !String(it.slug).startsWith('uf-'));
      // unique by slug
      const seen = new Set();
      const unique = [];
      for (const it of items) {
        if (seen.has(it.slug)) continue;
        seen.add(it.slug);
        unique.push(it);
      }
      const out = await ingest.hydrateFilmTraitsBatch(unique, {
        concurrency: 2,
        force: req.body?.force === true,
      });
      return res.status(200).json({ ...out, deskCount: unique.length });
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
  buildModuleHealthMap,
  buildTopIssues,
  buildRecommendedActions,
  filterActionableAlerts,
  listRecentMembers,
  toSafeMemberRow,
  parseSinceMs
};
