/**
 * Self-Runner v3 — governed auto-healing core (issue model, playbooks, signals, learning).
 * Single-module bundle to avoid OneDrive path issues with v3/ subfolder writes.
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const CONFIDENCE_PATH = path.join(SERVER_ROOT, 'data', 'ops', 'self-runner-confidence.json');
const LEARNING_PATH = path.join(SERVER_ROOT, 'data', 'ops', 'self-runner-learning.json');

const FIX_TYPES = ['data', 'config', 'cron', 'ingest', 'layout', 'code'];
const AUTO_HEAL_FIX_TYPES = new Set(['data', 'config', 'cron', 'ingest']);

const BLOCKED_PATCH_TYPES = new Set([
  'html-hook', 'html-hook-v2', 'ensure-team-shell', 'background-theme', 'missing-content',
  'team-content', 'component-variant', 'react-component', 'react-route', 'react-component-review',
  'react-route-verify', 'layout-overflow', 'panel-layering', 'ordering-fix', 'react-slug'
]);

const PLAYBOOKS = [
  { id: 'data-uuid-integrity', label: 'UUID / Data Integrity', fixType: 'data', issueTypes: ['uuid_mismatch'], subsystems: ['recruiting', 'portal'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 85, patchTypes: ['schema-field-v2'], opsJobs: ['recruiting-ingest', 'portal-ingest'] },
  { id: 'cron-auth-resync', label: 'Cron / Auth Resync', fixType: 'cron', issueTypes: ['auth_mismatch', 'cron_401'], subsystems: ['cron', 'ops'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 80, patchTypes: [], opsJobs: ['ops-healthcheck'] },
  { id: 'autoposter-stale-force', label: 'Autoposter Stale', fixType: 'cron', issueTypes: ['stale', 'no_posts_yet', 'queue_empty'], subsystems: ['autoposter'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 75, patchTypes: ['autoposter-force-run'], opsJobs: ['beat-writer-ingest', 'x-autoposter-run'] },
  { id: 'feed-dedupe-repair', label: 'Feed Dedupe', fixType: 'data', issueTypes: ['dedupe', 'feed_integrity'], subsystems: ['feed', 'live'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 90, patchTypes: ['feed-dedup-v2'], opsJobs: ['feed-repair'] },
  { id: 'recruiting-ingest-recover', label: 'Recruiting Ingest', fixType: 'ingest', issueTypes: ['ingest_failure', 'ingest_stuck'], subsystems: ['recruiting'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 70, patchTypes: ['schema-field-v2'], opsJobs: ['recruiting-ingest'] },
  { id: 'portal-sync-recover', label: 'Portal Sync', fixType: 'ingest', issueTypes: ['sync_stuck', 'sync_failure'], subsystems: ['portal'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 75, patchTypes: ['schema-field-v2'], opsJobs: ['portal-ingest'] },
  { id: 'war-room-refresh', label: 'War Room Refresh', fixType: 'data', issueTypes: ['stale_scouting', 'missing_card'], subsystems: ['war-room'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 70, patchTypes: ['war-room-refresh', 'queue-scouting-refresh'], opsJobs: [] },
  { id: 'film-source-repair', label: 'Film Sources', fixType: 'data', issueTypes: ['sources_broken', 'film_sources'], subsystems: ['film-room'], riskLevel: 'low', reversible: true, autoHealMinConfidence: 85, patchTypes: ['film-source-url'], opsJobs: [] }
];

const V3_MODES = {
  'scan-only': { id: 'scan-only', propose: true, apply: false, requireApproval: true },
  assisted: { id: 'assisted', propose: true, apply: false, requireApproval: true },
  'guarded-apply': { id: 'guarded-apply', propose: true, apply: true, requireApproval: false, verifyAfterApply: true, rollbackOnRegression: true },
  'full-auto-heal': { id: 'full-auto-heal', propose: true, apply: true, requireApproval: false, verifyAfterApply: true, rollbackOnRegression: true }
};

function normalizeIssue(raw = {}) {
  const subsystem = String(raw.subsystem || raw.module || 'unknown').toLowerCase();
  const type = String(raw.type || raw.issueType || 'unknown').toLowerCase();
  const evidence = normalizeEvidence(raw.evidence || raw.details || []);
  const fixType = normalizeFixType(raw.fixType || inferFixType(subsystem, type));
  return {
    id: raw.id || `issue_${subsystem}_${type}_${Date.now()}`,
    subsystem, type, fixType,
    severity: ['critical', 'high', 'medium', 'low'].includes(String(raw.severity || '').toLowerCase()) ? String(raw.severity).toLowerCase() : 'medium',
    title: raw.title || `${subsystem}: ${type}`,
    evidence,
    timestamp: raw.timestamp || new Date().toISOString(),
    checkId: raw.checkId || null,
    source: raw.source || 'v3-signals',
    verified: evidence.length > 0,
    metadata: raw.metadata || {}
  };
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return evidence ? [String(evidence)] : [];
  return evidence.map((e) => (typeof e === 'string' ? e : e?.message || e?.detail || JSON.stringify(e))).filter(Boolean).slice(0, 12);
}

function inferFixType(subsystem, type) {
  if (/autoposter|cron|scheduler/.test(subsystem + type)) return 'cron';
  if (/ingest|portal|on3|rivals/.test(subsystem + type)) return 'ingest';
  if (/layout|ux|visual/.test(subsystem + type)) return 'layout';
  if (/react|component|route/.test(subsystem + type)) return 'code';
  return 'data';
}

function normalizeFixType(ft) {
  const v = String(ft || 'data').toLowerCase();
  return FIX_TYPES.includes(v) ? v : 'data';
}

function findPlaybook(issue) {
  const sub = String(issue.subsystem || '').toLowerCase();
  const type = String(issue.type || '').toLowerCase();
  const checkId = String(issue.checkId || '').toLowerCase();
  for (const pb of PLAYBOOKS) {
    const subOk = !pb.subsystems?.length || pb.subsystems.some((s) => sub.includes(s) || checkId.includes(s));
    const typeOk = !pb.issueTypes?.length || pb.issueTypes.some((t) => type.includes(t) || checkId.includes(t));
    if (subOk && typeOk) return pb;
  }
  if (/feed-dedup|autoposter-dedup/.test(checkId)) return PLAYBOOKS.find((p) => p.id === 'feed-dedupe-repair');
  if (/film-sources/.test(checkId)) return PLAYBOOKS.find((p) => p.id === 'film-source-repair');
  if (/uuid/.test(checkId + type)) return PLAYBOOKS.find((p) => p.id === 'data-uuid-integrity');
  if (/autoposter|stale|no_posts/.test(checkId + type + sub)) return PLAYBOOKS.find((p) => p.id === 'autoposter-stale-force');
  return null;
}

function readConfidence() {
  try { return JSON.parse(fs.readFileSync(CONFIDENCE_PATH, 'utf8')); } catch { return { playbooks: {}, events: [] }; }
}

function getConfidence(playbookId) {
  return readConfidence().playbooks[playbookId]?.score ?? 50;
}

function confidenceBand(score) {
  if (score < 40) return 'never_auto';
  if (score < 70) return 'propose_only';
  if (score < 90) return 'guarded_auto';
  return 'fully_trusted';
}

function recordLearning(event) {
  const deltas = { fix_succeeded: 8, qa_passed: 5, health_improved: 6, coder_approved: 10, fix_failed: -12, qa_failed: -10, health_dropped: -15, coder_rejected: -8, rollback: -20 };
  const reason = event.outcome || event.coderAction;
  const delta = deltas[reason] ?? 0;
  if (!delta || !event.playbookId) return null;
  const doc = readConfidence();
  if (!doc.playbooks[event.playbookId]) doc.playbooks[event.playbookId] = { score: 50, history: [] };
  const prev = doc.playbooks[event.playbookId].score;
  const next = Math.max(0, Math.min(100, prev + delta));
  doc.playbooks[event.playbookId].score = next;
  doc.playbooks[event.playbookId].history.unshift({ at: new Date().toISOString(), prev, next, delta, reason });
  doc.events = doc.events || [];
  doc.events.unshift({ at: new Date().toISOString(), ...event, score: next });
  doc.events = doc.events.slice(0, 500);
  fs.mkdirSync(path.dirname(CONFIDENCE_PATH), { recursive: true });
  fs.writeFileSync(CONFIDENCE_PATH, JSON.stringify(doc, null, 2));
  try {
    let learn = {};
    try { learn = JSON.parse(fs.readFileSync(LEARNING_PATH, 'utf8')); } catch { learn = { events: [] }; }
    learn.events = learn.events || [];
    learn.events.unshift({ at: new Date().toISOString(), issue: event.issueId, playbook: event.playbookId, patch: event.patchType, result: reason, confidence: next });
    learn.events = learn.events.slice(0, 1000);
    fs.writeFileSync(LEARNING_PATH, JSON.stringify(learn, null, 2));
  } catch { /* optional */ }
  return { prev, next, band: confidenceBand(next) };
}

function v3Mode() {
  const raw = String(process.env.SELF_RUNNER_MODE || 'scan-only').toLowerCase();
  if (raw === 'auto-repair') return 'guarded-apply';
  return V3_MODES[raw] ? raw : 'scan-only';
}

function isPatchBlocked(patchType) {
  return BLOCKED_PATCH_TYPES.has(String(patchType || '').toLowerCase());
}

function canPropose(proposal) {
  if (isPatchBlocked(proposal?.patchType)) return { ok: false, reason: 'blocked_patch_type_v3' };
  if (['layout', 'code'].includes(normalizeFixType(proposal?.fixType))) return { ok: false, reason: 'layout_code_manual_only' };
  return { ok: true };
}

function canAutoApply(proposal, playbook) {
  const mode = v3Mode();
  const cfg = V3_MODES[mode];
  if (!cfg?.apply) return { ok: false, reason: 'mode_no_apply' };
  if (isPatchBlocked(proposal?.patchType)) return { ok: false, reason: 'blocked_patch_type' };
  if (!AUTO_HEAL_FIX_TYPES.has(normalizeFixType(proposal?.fixType || playbook?.fixType))) return { ok: false, reason: 'fix_type_blocked' };
  const conf = getConfidence(playbook?.id || proposal?.playbookId || '');
  const min = playbook?.autoHealMinConfidence ?? 90;
  if (conf < min) return { ok: false, reason: 'low_confidence', confidence: conf };
  if (mode === 'guarded-apply' && (proposal?.riskLevel || playbook?.riskLevel) !== 'low') return { ok: false, reason: 'not_low_risk' };
  if (mode === 'full-auto-heal' && conf < 90) return { ok: false, reason: 'not_fully_trusted' };
  return { ok: true, mode, confidence: conf };
}

async function collectSignals() {
  const issues = [];
  try {
    const autoposterFreshness = require('../autoposter-freshness');
    const ap = autoposterFreshness.getAutoposterStatus?.() || {};
    if (ap.status === 'red' || !ap.lastPostAt) {
      issues.push(normalizeIssue({
        subsystem: 'autoposter', type: ap.lastPostAt ? 'stale' : 'no_posts_yet', severity: 'high',
        evidence: [`Last post: ${ap.lastPostLabel || 'never'}`, `Queue pending: ${ap.queuePending ?? 0}`, `Status: ${ap.status}`],
        checkId: 'integrity:autoposter-stale'
      }));
    }
  } catch { /* optional */ }

  try {
    const dedupe = require('./dedupe-engine');
    const items = require('./context-patch-generator').loadFeedItemsForPatch?.() || [];
    if (items.length) {
      const v = dedupe.validateFeedIntegrity(items);
      if (!v.ok) {
        issues.push(normalizeIssue({
          subsystem: 'feed', type: 'feed_integrity', severity: 'critical',
          evidence: v.issues.slice(0, 6).map((i) => `${i.type}: ${i.id || i.reason || 'issue'}`),
          checkId: 'integrity:autoposter-dedup'
        }));
      }
    }
  } catch { /* optional */ }

  try {
    const qaStore = require('../qa/qa-store');
    const run = (qaStore.readDoc().runs || [])[0];
    if (run && !run.pass) {
      (run.summary?.failedChecks || []).slice(0, 8).forEach((c) => {
        if (/integrity:|feed-dedup|film-sources|recruiting|portal/.test(c.id || '')) {
          issues.push(normalizeIssue({
            subsystem: c.module || 'qa', type: 'check_failed', severity: 'high',
            evidence: [c.error || c.id], checkId: c.id, source: 'qa-crawler'
          }));
        }
      });
    }
  } catch { /* optional */ }

  return issues.filter((i) => i.verified);
}

function enrichProposal(proposal, issue) {
  const playbook = findPlaybook(issue || proposal);
  const fixType = normalizeFixType(proposal?.fixType || playbook?.fixType || issue?.fixType);
  return {
    ...proposal,
    fixType,
    playbookId: playbook?.id || null,
    playbookLabel: playbook?.label || null,
    confidence: playbook ? getConfidence(playbook.id) : 50,
    confidenceBand: confidenceBand(playbook ? getConfidence(playbook.id) : 50),
    autoHealEligible: playbook ? canAutoApply({ ...proposal, fixType }, playbook).ok : false,
    v3: true,
    engineVersion: '3.0.0'
  };
}

async function runV3Scan(opts = {}) {
  const signals = await collectSignals();
  const diagnosed = signals.map((issue) => {
    const playbook = findPlaybook(issue);
    return { issue, playbook, confidence: playbook ? getConfidence(playbook.id) : 0, confidenceBand: confidenceBand(playbook ? getConfidence(playbook.id) : 0) };
  });
  return {
    ok: true,
    mode: v3Mode(),
    scannedAt: new Date().toISOString(),
    issueCount: diagnosed.length,
    issues: diagnosed,
    playbooks: PLAYBOOKS.map((pb) => ({ ...pb, confidence: getConfidence(pb.id), band: confidenceBand(getConfidence(pb.id)) }))
  };
}

async function runVerificationPipeline(before, afterFn) {
  const productStore = require('../product-intel/product-intel-store');
  const scoring = require('../product-intel/product-intel-scoring');
  const beforeScore = scoring.computeOverallScore?.(productStore.readDoc()) ?? before?.healthScore ?? null;
  let after = null;
  try {
    if (typeof afterFn === 'function') after = await afterFn();
  } catch (err) {
    return { ok: false, regression: true, error: err.message, beforeScore, afterScore: null };
  }
  const afterDoc = productStore.readDoc();
  const afterScore = scoring.computeOverallScore?.(afterDoc) ?? after?.healthScore ?? null;
  const regression = beforeScore != null && afterScore != null && afterScore < beforeScore - 2;
  return { ok: !regression, regression, beforeScore, afterScore, qaPass: after?.qaPass ?? null };
}

module.exports = {
  FIX_TYPES,
  AUTO_HEAL_FIX_TYPES,
  BLOCKED_PATCH_TYPES,
  PLAYBOOKS,
  V3_MODES,
  normalizeIssue,
  findPlaybook,
  getConfidence,
  confidenceBand,
  recordLearning,
  v3Mode,
  isPatchBlocked,
  canPropose,
  canAutoApply,
  collectSignals,
  enrichProposal,
  runV3Scan,
  runVerificationPipeline
};
