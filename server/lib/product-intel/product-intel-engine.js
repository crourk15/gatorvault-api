/**
 * Product Intelligence Engine — 5-layer pipeline:
 * 1 Data → 2 Classification → 3 Severity → 4 Proposals → 5 Approval Gate (Self-Runner)
 */
const qaStore = require('../qa/qa-store');
const store = require('./product-intel-store');
const scoring = require('./product-intel-scoring');
const dataLayer = require('./product-intel-data-layer');
const classifier = require('./product-intel-classifier');
const severity = require('./product-intel-severity');
const proposals = require('./product-intel-proposals');

function severityRank(sev) {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[sev] || 0;
}

function signalKeyFor(item) {
  return item.checkId || item.classification || item.id;
}

function suggestedFixForCheck(check) {
  const id = String(check.id || '');
  const meta = proposals.buildProposalMetadata({ checkId: id, module: check.module, title: check.error }, check);
  if (meta.description) return meta.description;

  if (id.includes('feed-dedup') || id.includes('autoposter-dedup')) {
    return 'Run live feed commit dedupe; remove legacy rec_evt rows for same player URL in feed-items.json';
  }
  if (id.includes('layout-overflow') || id.includes('panel-clipping')) {
    return 'Add modal overflow guards to css/gv-team.css — min-height:0, min-width:0, overflow-wrap on text blocks';
  }
  if (id.includes('missing-content')) {
    return 'Restore missing section hooks in index.html and data/coaching-staff.json for all site sections';
  }
  if (id.includes('wrong-background')) {
    return 'Replace og-image.jpg / trial backgrounds with era gradient classes on Team Identity banner';
  }
  if (id.includes('team-history-structure')) {
    return 'Fix ERAS in gv-team-mobile.js — 5 eras with full coaching/milestones; Spurrier only in era-90s';
  }
  if (id.includes('filmroom-structure')) {
    return 'Wire Film Room drill-down hub: film-room-hub-landing, GV_FILM_HUB_DESC, gvOpenFilmRoomHub';
  }
  if (id.includes('film-sources')) {
    return 'Update Film Room knowledge source URLs via apply-film-room-sources.js with verified live links';
  }
  if (check.module === 'visual-integrity' || id.startsWith('visual-integrity:')) {
    const mapper = require('../visual-integrity/visual-integrity-mapper');
    return mapper.suggestedFix(id, check.details);
  }
  if (check.module === 'api') {
    return 'Check Render API logs and restore failing endpoint; verify health check passes';
  }
  return check.repro || check.error || `Fix QA check: ${check.label || id}`;
}

function enrichFixItem(signal, run, historyDoc, runCount) {
  const checkId = signal.id || signal.checkId;
  const scored = severity.scoreIssue(signal, historyDoc[signalKeyFor({ checkId, classification: signal.classification })], runCount);
  const proposal = proposals.buildProposalMetadata(
    {
      checkId,
      module: signal.module,
      title: signal.error || signal.label,
      suggestedFix: suggestedFixForCheck(signal),
      classification: scored.classification,
      ruleId: scored.ruleId,
      category: scored.category,
      severity: scored.severity,
      severityScore: scored.severityScore
    },
    signal
  );

  return {
    id: `fix_${checkId}`,
    title: signal.error || signal.label || checkId,
    module: signal.module || 'integrity',
    source: signal.source || signal.module || 'qa-crawler',
    classification: scored.classification,
    ruleId: scored.ruleId,
    category: scored.category,
    ruleName: scored.ruleName,
    severity: scored.severity,
    severityScore: scored.severityScore,
    severityLabel: scored.severityLabel,
    severityComponents: scored.components,
    impact: scored.impact,
    repro: signal.repro || null,
    suggestedFix: proposal.description,
    eta: scored.eta,
    checkId,
    url: signal.url || null,
    details: signal.details || null,
    proposal,
    createdAt: run?.finishedAt || new Date().toISOString(),
    runId: run?.id || null,
    resolved: false
  };
}

function buildFixQueue(signals, run, existingQueue, doc, runCount) {
  // Drop resolved / cleared checks; keep only unresolved items without a checkId (manual entries).
  const kept = (existingQueue || []).filter((item) => {
    if (item.resolved) return false;
    if (item.checkId) return false;
    return true;
  });

  const seen = new Set();
  const items = [];

  signals.forEach((signal) => {
    const checkId = signal.id || signal.checkId;
    if (seen.has(checkId)) return;
    seen.add(checkId);

    const key = signalKeyFor({ checkId, classification: signal.classification });
    store.bumpSignalHistory(doc, key);

    items.push(enrichFixItem(signal, run, doc.signalHistory || {}, runCount));
  });

  const byId = new Map(kept.map((i) => [i.id, i]));
  items.forEach((item) => {
    const prev = byId.get(item.id);
    byId.set(item.id, prev ? { ...prev, ...item, updatedAt: new Date().toISOString() } : item);
  });

  return [...byId.values()].sort((a, b) => {
    const scoreDiff = (b.severityScore || 0) - (a.severityScore || 0);
    if (scoreDiff) return scoreDiff;
    return severityRank(b.severity) - severityRank(a.severity);
  });
}

function topIssuesFromRun(run, limit = 8) {
  const failed = scoring.flattenChecks(run).filter((c) => !c.pass);
  return failed
    .map((c) => {
      const scored = severity.scoreIssue(c, null, 1);
      return {
        id: c.id,
        module: c.module,
        message: c.error || c.label,
        severity: scored.severity,
        severityScore: scored.severityScore,
        classification: scored.classification,
        url: c.url || null
      };
    })
    .sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0))
    .slice(0, limit);
}

function narrativeSummary({ overall, moduleScores, topIssues, pass, signalCounts }) {
  const parts = [];
  parts.push(
    pass
      ? `Platform health is strong at ${overall}/100 — all checks passed.`
      : `Platform health scored ${overall}/100 with ${topIssues.length} prioritized issue(s).`
  );
  if (signalCounts?.total) {
    parts.push(`Data layer collected ${signalCounts.total} signal(s) across ${Object.keys(signalCounts.bySource || {}).length} sources.`);
  }
  const weak = Object.entries(moduleScores || {})
    .filter(([k, v]) => k !== 'overall' && typeof v === 'number' && v < 75)
    .sort((a, b) => a[1] - b[1]);
  if (weak.length) {
    parts.push(`Weakest modules: ${weak.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
  }
  if (topIssues[0]) {
    parts.push(
      `Top: [${topIssues[0].severity}/${topIssues[0].severityScore}] ${topIssues[0].classification}: ${topIssues[0].message}`
    );
  }
  return parts.join(' ');
}

function buildDailySummary(doc, run, scores, signalCounts) {
  const date = (run.finishedAt || new Date().toISOString()).slice(0, 10);
  const prev = (doc.dailySummaries || []).find((s) => s.date < date);
  const topIssues = topIssuesFromRun(run);
  const overall = scores.modules.overall;

  const improvements = [];
  const regressions = [];

  if (prev) {
    if (overall > prev.overallHealth) improvements.push(`Overall health up ${prev.overallHealth} → ${overall}`);
    else if (overall < prev.overallHealth) regressions.push(`Overall health down ${prev.overallHealth} → ${overall}`);
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
    signalCounts,
    narrative: narrativeSummary({ overall, moduleScores: scores.modules, topIssues, pass: run.pass, signalCounts })
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
  const latest = buildDailySummary(doc, run, scores, doc.intelligenceLayers?.data?.counts);

  return {
    weekOf,
    trend: { overall: { from: latest.overallHealth, to: latest.overallHealth } },
    biggestWins: latest.improvements || [],
    biggestGaps: topIssuesFromRun(run, 5).map((i) => i.message),
    priorityFixes: (doc.fixQueue || [])
      .filter((f) => !f.resolved)
      .slice(0, 8)
      .map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        severityScore: f.severityScore,
        classification: f.classification,
        eta: f.eta
      })),
    overallHealth: latest.overallHealth,
    narrative: `Week of ${weekOf}: ${latest.overallHealth}/100 health. ${latest.topIssues.length} open issue(s).`
  };
}

async function recomputeFromRun(run, opts = {}) {
  if (!run || !run.modules) {
    throw new Error('Invalid QA run — missing modules');
  }

  const qaDoc = qaStore.readDoc();
  const uptimePct =
    qaDoc.uptime?.checks > 0
      ? Math.round((qaDoc.uptime.successes / qaDoc.uptime.checks) * 1000) / 10
      : 100;

  const runCount = (qaDoc.runs || []).length;

  // Layer 1 — Data
  const collected = await dataLayer.collectAllSignals(run);

  // Dedupe: QA check ids take precedence over PI signals with overlapping classification
  const qaIds = new Set(collected.layers.qa.map((c) => c.id));
  const piOnly = [
    ...collected.layers.apiHealth,
    ...collected.layers.cacheHealth,
    ...collected.layers.autoposter,
    ...collected.layers.recruiting,
    ...collected.layers.teamData,
    ...collected.layers.filmRoom
  ].filter((s) => !qaIds.has(s.id));

  const allSignals = [...collected.layers.qa, ...piOnly];

  const modules = scoring.moduleScoresFromRun(run);
  const pages = scoring.pageScoresFromRun(run);
  const features = scoring.featureScoresFromRun(run, uptimePct);
  const recommendations = scoring.buildRecommendations({ moduleScores: modules, featureScores: features, pageScores: pages });
  const scores = { modules, pages, features, overall: modules.overall };

  let doc = store.readDoc();
  doc = store.decaySignalHistory(doc);

  const fixItems = buildFixQueue(allSignals, run, doc.fixQueue, doc, runCount);

  // Layer metadata snapshot
  const classifications = [...new Set(fixItems.map((f) => f.classification))];
  doc.intelligenceLayers = {
    data: { counts: collected.counts, sources: classifier.loadRules().dataSources },
    classification: { active: classifications, total: fixItems.length },
    severity: {
      critical: fixItems.filter((f) => f.severity === 'critical').length,
      high: fixItems.filter((f) => f.severity === 'high').length,
      medium: fixItems.filter((f) => f.severity === 'medium').length,
      low: fixItems.filter((f) => f.severity === 'low').length
    },
    proposals: fixItems.filter((f) => f.proposal).length,
    approvalGate: 'self-runner'
  };

  doc.lastRunId = run.id;
  doc.lastComputedAt = run.finishedAt || new Date().toISOString();
  doc.scores = scores;
  doc.recommendations = recommendations;
  doc.fixQueue = fixItems.slice(0, 200);

  if (opts.daily !== false) {
    doc = store.pushDailySummary(doc, buildDailySummary(doc, run, scores, collected.counts));
  }
  if (opts.weekly) {
    doc = store.pushWeeklyReport(doc, buildWeeklyReport(doc, run, scores));
  }

  doc = store.pushSnapshot(doc, {
    at: doc.lastComputedAt,
    runId: run.id,
    overall: scores.overall,
    modules: scores.modules,
    pass: run.pass,
    openFixes: fixItems.filter((f) => !f.resolved).length,
    layers: doc.intelligenceLayers
  });

  store.writeDoc(doc);

  if (run.pass) {
    try {
      qaStore.clearErrorsOnPass(run);
    } catch {
      /* optional */
    }
  }

  try {
    const opsMonitor = require('../ops-monitor');
    opsMonitor.heartbeat({
      subsystem: 'product-intel',
      status: run.pass && !fixItems.length ? 'success' : 'warning',
      message: `Product Intelligence ${scores.overall}/100`,
      details: {
        lastComputedAt: doc.lastComputedAt,
        runId: run.id,
        openFixes: fixItems.filter((f) => !f.resolved).length
      }
    });
    opsMonitor.logEvent({
      subsystem: 'product-intel',
      status: run.pass && !fixItems.length ? 'success' : 'warning',
      message: `Product Intelligence scored ${scores.overall}/100 — ${fixItems.length} fix item(s)`,
      details: {
        runId: run.id,
        overall: scores.overall,
        fixQueue: fixItems.filter((f) => !f.resolved).length,
        layers: doc.intelligenceLayers
      }
    });
  } catch {
    /* optional */
  }

  return {
    scores,
    fixQueue: doc.fixQueue,
    recommendations,
    daily: store.getTodaySummary(doc),
    intelligenceLayers: doc.intelligenceLayers,
    signalCounts: collected.counts
  };
}

async function recomputeFromLatestRun(opts = {}) {
  const qaDoc = qaStore.readDoc();
  const run = (qaDoc.runs || [])[0];
  if (!run) return { ok: false, reason: 'no_qa_runs' };
  const result = await recomputeFromRun(run, opts);
  return { ok: true, ...result };
}

function runDailyJob() {
  return recomputeFromLatestRun({ daily: true, weekly: false }).then((result) => {
    console.log('[product-intel] daily summary updated', result.scores?.overall ?? result.reason);
    return result;
  });
}

function runWeeklyJob() {
  return recomputeFromLatestRun({ daily: true, weekly: true }).then((result) => {
    console.log('[product-intel] weekly report generated', result.scores?.overall ?? result.reason);
    return result;
  });
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
    recommendations: doc.recommendations ?? { remove: [], keep: [], upgrade: [] },
    intelligenceLayers: doc.intelligenceLayers ?? null
  };
}

function getLayersPayload() {
  const doc = store.readDoc();
  const rules = classifier.loadRules();
  return {
    layers: doc.intelligenceLayers,
    classifications: rules.classifications,
    categories: rules.categories,
    severityBands: rules.severityBands,
    signalHistory: doc.signalHistory,
    dataSources: rules.dataSources
  };
}

module.exports = {
  recomputeFromRun,
  recomputeFromLatestRun,
  runDailyJob,
  runWeeklyJob,
  getScoresPayload,
  getLayersPayload,
  buildDailySummary,
  buildWeeklyReport,
  topIssuesFromRun,
  buildFixQueue,
  enrichFixItem
};
