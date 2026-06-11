/**
 * Product Intelligence — recompute scores, fix queue, daily/weekly reports from QA runs.
 */
const qaStore = require('../qa/qa-store');
const store = require('./product-intel-store');
const scoring = require('./product-intel-scoring');

function severityRank(sev) {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[sev] || 0;
}

function suggestedFixForCheck(check) {
  const id = String(check.id || '');
  if (id.includes('feed-dedup')) {
    return 'Run live feed commit dedupe; remove legacy rec_evt rows for same player URL in feed-items.json';
  }
  if (id.includes('film-sources')) {
    return 'Update Film Room knowledge source URLs via apply-film-room-sources.js with verified live links';
  }
  if (check.module === 'visual-integrity' || id.startsWith('visual-integrity:')) {
    const mapper = require('../visual-integrity/visual-integrity-mapper');
    return mapper.suggestedFix(id, check.details);
  }
  if (id.includes('admin-hub')) {
    return 'Deploy admin.html with admin-hub-core.js embedded on /admin';
  }
  if (id.includes('team-hooks')) {
    return 'Ship gv-team-mobile.js hooks and gv-team-detail-modal in index.html';
  }
  if (id.includes('film-room-hooks')) {
    return 'Wire gvOpenVerifiedSource, gv-film-source, and gv-verified-source-modal in index.html';
  }
  if (check.module === 'api') {
    return 'Check Render API logs and restore failing endpoint; verify health check passes';
  }
  if (check.module === 'ux') {
    return 'Review CSS markers in index.html — modal z-index, tap targets, safe-area';
  }
  if (check.module === 'mobile-behavior' || id.startsWith('mobile-behavior:')) {
    const issues = check.details?.issues || [];
    if (issues.length) return issues[0].suggestedFix || issues[0].description;
    if (id.includes('stale-html')) {
      return 'Deploy latest server/index.html to Netlify; verify meta gv-build matches repo and trigger build hook';
    }
    if (id.includes('team-tab-theme')) {
      return 'Ensure #vpane-mteam uses gv-team-page; hide trial-expired-gate when trial active; deploy static site';
    }
    if (id.includes('navigation')) {
      return 'Wire history.pushState/popstate for profile and team modals (gvPushModalHistory helpers)';
    }
    if (id.includes('feed-freshness')) {
      return 'Force gvLoadLiveDashboard(true) on Home tab focus; verify feed-items.json ingest freshness';
    }
    return check.repro || 'Fix mobile behavior QA failure — see Admin → QA → Mobile Behavior';
  }
  return check.repro || `Fix QA check: ${check.label || id}`;
}

function fixItemsFromRun(run, existingQueue) {
  const failed = scoring.flattenChecks(run).filter((c) => !c.pass);
  const openCheckIds = new Set(failed.map((c) => c.id));

  const kept = (existingQueue || []).filter((item) => {
    if (item.checkId && openCheckIds.has(item.checkId)) return false;
    if (item.checkId && !openCheckIds.has(item.checkId)) return false;
    return !item.resolved;
  });

  const items = failed.map((check) => ({
    id: `fix_${check.id}`,
    title: check.error || check.label || check.id,
    module: check.module || 'unknown',
    severity: scoring.inferSeverity(check),
    impact: scoring.inferImpact(check),
    repro: check.repro || null,
    suggestedFix: suggestedFixForCheck(check),
    eta: scoring.inferEta(scoring.inferSeverity(check)),
    checkId: check.id,
    url: check.url || null,
    createdAt: run.finishedAt || new Date().toISOString(),
    runId: run.id,
    resolved: false
  }));

  const byId = new Map(kept.map((i) => [i.id, i]));
  items.forEach((item) => {
    const prev = byId.get(item.id);
    byId.set(item.id, prev ? { ...prev, ...item, updatedAt: new Date().toISOString() } : item);
  });

  return [...byId.values()];
}

function topIssuesFromRun(run, limit = 8) {
  return scoring
    .flattenChecks(run)
    .filter((c) => !c.pass)
    .map((c) => ({
      id: c.id,
      module: c.module,
      message: c.error || c.label,
      severity: scoring.inferSeverity(c),
      url: c.url || null
    }))
    .sort((a, b) => scoring.SEVERITY_WEIGHTS[b.severity] - scoring.SEVERITY_WEIGHTS[a.severity])
    .slice(0, limit);
}

function narrativeSummary({ overall, moduleScores, topIssues, pass }) {
  const parts = [];
  parts.push(
    pass
      ? `Platform health is strong at ${overall}/100 — all QA modules passed.`
      : `Platform health scored ${overall}/100 with ${topIssues.length} prioritized issue(s).`
  );
  const weak = Object.entries(moduleScores || {})
    .filter(([k, v]) => k !== 'overall' && typeof v === 'number' && v < 75)
    .sort((a, b) => a[1] - b[1]);
  if (weak.length) {
    parts.push(`Weakest modules: ${weak.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
  }
  if (topIssues[0]) {
    parts.push(`Top issue: ${topIssues[0].message} [${topIssues[0].severity}].`);
  }
  return parts.join(' ');
}

function buildDailySummary(doc, run, scores) {
  const date = (run.finishedAt || new Date().toISOString()).slice(0, 10);
  const prev = (doc.dailySummaries || []).find((s) => s.date < date);
  const topIssues = topIssuesFromRun(run);
  const overall = scores.modules.overall;

  const improvements = [];
  const regressions = [];

  if (prev) {
    if (overall > prev.overallHealth) {
      improvements.push(`Overall health up ${prev.overallHealth} → ${overall}`);
    } else if (overall < prev.overallHealth) {
      regressions.push(`Overall health down ${prev.overallHealth} → ${overall}`);
    }
    scoring.QA_MODULES.forEach((mod) => {
      const now = scores.modules[mod];
      const was = prev.moduleScores?.[mod];
      if (typeof now === 'number' && typeof was === 'number') {
        if (now > was + 5) improvements.push(`${mod} +${now - was}`);
        if (now < was - 5) regressions.push(`${mod} ${now - was}`);
      }
    });
  }

  return {
    date,
    overallHealth: overall,
    moduleScores: { ...scores.modules },
    pageScores: { ...scores.pages },
    featureScores: { ...scores.features },
    topIssues,
    improvements,
    regressions,
    pass: run.pass,
    runId: run.id,
    narrative: narrativeSummary({ overall, moduleScores: scores.modules, topIssues, pass: run.pass })
  };
}

function weekStartIso(dateStr) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function buildWeeklyReport(doc, run, scores) {
  const weekOf = weekStartIso((run.finishedAt || new Date().toISOString()).slice(0, 10));
  const summaries = (doc.dailySummaries || []).filter((s) => s.date >= weekOf);
  const first = summaries[summaries.length - 1] || doc.dailySummaries?.[1];
  const latest = summaries[0] || buildDailySummary(doc, run, scores);

  const trend = { overall: { from: first?.overallHealth ?? latest.overallHealth, to: latest.overallHealth } };
  scoring.QA_MODULES.forEach((mod) => {
    trend[mod] = {
      from: first?.moduleScores?.[mod] ?? latest.moduleScores?.[mod],
      to: latest.moduleScores?.[mod]
    };
  });

  const biggestWins = (latest.improvements || []).slice(0, 5);
  const biggestGaps = topIssuesFromRun(run, 5).map((i) => i.message);
  const priorityFixes = (doc.fixQueue || [])
    .filter((f) => !f.resolved)
    .slice(0, 8)
    .map((f) => ({ id: f.id, title: f.title, severity: f.severity, eta: f.eta }));

  return {
    weekOf,
    trend,
    biggestWins,
    biggestGaps,
    priorityFixes,
    overallHealth: latest.overallHealth,
    narrative: `Week of ${weekOf}: health ${trend.overall.from} → ${trend.overall.to}. ${biggestGaps.length ? `${biggestGaps.length} open gap(s).` : 'No critical gaps this week.'}`
  };
}

function recomputeFromRun(run, opts = {}) {
  if (!run || !run.modules) {
    throw new Error('Invalid QA run — missing modules');
  }

  const qaDoc = qaStore.readDoc();
  const uptimePct =
    qaDoc.uptime?.checks > 0
      ? Math.round((qaDoc.uptime.successes / qaDoc.uptime.checks) * 1000) / 10
      : 100;

  const modules = scoring.moduleScoresFromRun(run);
  const pages = scoring.pageScoresFromRun(run);
  const features = scoring.featureScoresFromRun(run, uptimePct);
  const recommendations = scoring.buildRecommendations({ moduleScores: modules, featureScores: features, pageScores: pages });

  const scores = { modules, pages, features, overall: modules.overall };

  let doc = store.readDoc();
  doc.lastRunId = run.id;
  doc.lastComputedAt = run.finishedAt || new Date().toISOString();
  doc.scores = scores;
  doc.recommendations = recommendations;

  const fixItems = fixItemsFromRun(run, doc.fixQueue);
  doc.fixQueue = fixItems
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 200);

  if (opts.daily !== false) {
    const daily = buildDailySummary(doc, run, scores);
    doc = store.pushDailySummary(doc, daily);
  }

  if (opts.weekly) {
    const weekly = buildWeeklyReport(doc, run, scores);
    doc = store.pushWeeklyReport(doc, weekly);
  }

  doc = store.pushSnapshot(doc, {
    at: doc.lastComputedAt,
    runId: run.id,
    overall: scores.overall,
    modules: scores.modules,
    pass: run.pass
  });

  store.writeDoc(doc);

  try {
    const opsMonitor = require('../ops-monitor');
    opsMonitor.logEvent({
      subsystem: 'product-intel',
      status: run.pass ? 'success' : 'warning',
      message: `Product Intelligence scored ${scores.overall}/100`,
      details: { runId: run.id, overall: scores.overall, fixQueue: doc.fixQueue.filter((f) => !f.resolved).length }
    });
  } catch {
    /* optional */
  }

  return { scores, fixQueue: doc.fixQueue, recommendations, daily: store.getTodaySummary(doc) };
}

function recomputeFromLatestRun(opts = {}) {
  const qaDoc = qaStore.readDoc();
  const run = (qaDoc.runs || [])[0];
  if (!run) {
    return { ok: false, reason: 'no_qa_runs' };
  }
  return { ok: true, ...recomputeFromRun(run, opts) };
}

function runDailyJob() {
  const result = recomputeFromLatestRun({ daily: true, weekly: false });
  console.log('[product-intel] daily summary updated', result.scores?.overall ?? result.reason);
  return result;
}

function runWeeklyJob() {
  const result = recomputeFromLatestRun({ daily: true, weekly: true });
  console.log('[product-intel] weekly report generated', result.scores?.overall ?? result.reason);
  return result;
}

function getScoresPayload() {
  const doc = store.readDoc();
  return {
    overall: doc.scores?.overall ?? null,
    modules: doc.scores?.modules ?? {},
    pages: doc.scores?.pages ?? {},
    features: doc.scores?.features ?? {},
    color: scoring.healthColor(doc.scores?.overall ?? 0),
    lastComputedAt: doc.lastComputedAt,
    lastRunId: doc.lastRunId,
    recommendations: doc.recommendations ?? { remove: [], keep: [], upgrade: [] }
  };
}

module.exports = {
  recomputeFromRun,
  recomputeFromLatestRun,
  runDailyJob,
  runWeeklyJob,
  getScoresPayload,
  buildDailySummary,
  buildWeeklyReport,
  topIssuesFromRun
};
