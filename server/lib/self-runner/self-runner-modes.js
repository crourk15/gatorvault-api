/**
 * Self-Runner v3 — execution modes, safety gates, playbook registry.
 */
const fs = require('fs');
const path = require('path');

const CONFIDENCE_PATH = path.join(__dirname, '..', '..', 'data', 'ops', 'self-runner-confidence.json');

const FIX_TYPES = ['data', 'config', 'cron', 'ingest', 'layout', 'code'];
const AUTO_HEAL_FIX_TYPES = new Set(['data', 'config', 'cron', 'ingest']);

const BLOCKED_PATCH_TYPES = new Set([
  'html-hook', 'html-hook-v2', 'ensure-team-shell', 'background-theme', 'missing-content',
  'team-content', 'component-variant', 'react-component', 'react-route', 'react-component-review',
  'react-route-verify', 'react-slug', 'layout-overflow', 'panel-layering', 'ordering-fix',
  'react-css', 'react-rebuild', 'similarity-filter', 'recruiting-board-sync', 'roster-sync'
]);

const V3_ALLOWED_PATCH_TYPES = new Set([
  'feed-dedup-v2', 'film-source-url', 'schema-field-v2', 'war-room-refresh',
  'war-room-missing-card', 'queue-scouting-refresh', 'multi-file-v2', 'autoposter-force-run'
]);

const PLAYBOOKS = [
  { id: 'data-uuid-integrity', label: 'UUID / Data Integrity', fixType: 'data', issueTypes: ['uuid_mismatch'], subsystems: ['recruiting', 'portal'], riskLevel: 'low', autoHealMinConfidence: 85, patchTypes: ['schema-field-v2'] },
  { id: 'cron-auth-resync', label: 'Cron / Auth Resync', fixType: 'cron', issueTypes: ['auth_mismatch', 'cron_401'], subsystems: ['cron', 'ops'], riskLevel: 'low', autoHealMinConfidence: 80, patchTypes: [] },
  { id: 'autoposter-stale-force', label: 'Autoposter Stale', fixType: 'cron', issueTypes: ['stale', 'no_posts_yet'], subsystems: ['autoposter'], riskLevel: 'low', autoHealMinConfidence: 75, patchTypes: ['autoposter-force-run'] },
  { id: 'feed-dedupe-repair', label: 'Feed Dedupe', fixType: 'data', issueTypes: ['dedupe', 'feed_integrity'], subsystems: ['feed', 'live'], riskLevel: 'low', autoHealMinConfidence: 90, patchTypes: ['feed-dedup-v2'] },
  { id: 'recruiting-ingest-recover', label: 'Recruiting Ingest', fixType: 'ingest', issueTypes: ['ingest_failure'], subsystems: ['recruiting'], riskLevel: 'low', autoHealMinConfidence: 70, patchTypes: ['schema-field-v2'] },
  { id: 'portal-sync-recover', label: 'Portal Sync', fixType: 'ingest', issueTypes: ['sync_stuck'], subsystems: ['portal'], riskLevel: 'low', autoHealMinConfidence: 75, patchTypes: ['schema-field-v2'] },
  { id: 'war-room-refresh', label: 'War Room Refresh', fixType: 'data', issueTypes: ['stale_scouting'], subsystems: ['war-room'], riskLevel: 'low', autoHealMinConfidence: 70, patchTypes: ['war-room-refresh'] },
  { id: 'film-source-repair', label: 'Film Sources', fixType: 'data', issueTypes: ['sources_broken', 'film_sources'], subsystems: ['film-room'], riskLevel: 'low', autoHealMinConfidence: 85, patchTypes: ['film-source-url'] }
];

const MODES = {
  'scan-only': {
    id: 'scan-only',
    label: 'Scan Only',
    proposePatches: true,
    applyPatches: false,
    requireApproval: true,
    description: 'Detect, diagnose, propose — no automatic changes (v3 default)'
  },
  assisted: {
    id: 'assisted',
    label: 'Assisted',
    proposePatches: true,
    applyPatches: false,
    requireApproval: true,
    description: 'Propose governed fixes; manual Approve/Reject required'
  },
  'guarded-apply': {
    id: 'guarded-apply',
    label: 'Guarded Apply',
    proposePatches: true,
    applyPatches: true,
    requireApproval: false,
    autoRiskLevels: ['low'],
    verifyAfterApply: true,
    rollbackOnRegression: true,
    description: 'Auto-apply low-risk reversible ops fixes with QA verification + rollback'
  },
  'full-auto-heal': {
    id: 'full-auto-heal',
    label: 'Full Auto-Heal',
    proposePatches: true,
    applyPatches: true,
    requireApproval: false,
    verifyAfterApply: true,
    rollbackOnRegression: true,
    subsystemOptIn: true,
    description: 'Trusted playbooks only — opt-in per subsystem via SELF_RUNNER_AUTO_HEAL_SUBSYSTEMS'
  },
  'auto-repair': {
    id: 'guarded-apply',
    label: 'Guarded Apply',
    proposePatches: true,
    applyPatches: true,
    requireApproval: false,
    autoRiskLevels: ['low'],
    verifyAfterApply: true,
    description: 'Legacy alias for guarded-apply'
  }
};

function isV3Enabled() {
  return process.env.SELF_RUNNER_V3 !== 'false';
}

function isV3OpsOnly() {
  return isV3Enabled();
}

function currentMode() {
  const raw = String(process.env.SELF_RUNNER_MODE || 'scan-only').toLowerCase();
  if (raw === 'auto-repair') return 'guarded-apply';
  const key = MODES[raw] ? raw : 'scan-only';
  return key === 'auto-repair' ? 'guarded-apply' : key;
}

function getModeConfig(modeId) {
  const id = modeId || currentMode();
  if (id === 'auto-repair') return MODES['guarded-apply'];
  return MODES[id] || MODES['scan-only'];
}

function readConfidenceDoc() {
  try {
    return JSON.parse(fs.readFileSync(CONFIDENCE_PATH, 'utf8'));
  } catch {
    return { version: 3, playbooks: {}, events: [] };
  }
}

function writeConfidenceDoc(doc) {
  fs.mkdirSync(path.dirname(CONFIDENCE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIDENCE_PATH, JSON.stringify(doc, null, 2));
}

function recordLearningEvent(event) {
  const deltas = {
    fix_succeeded: 8,
    qa_passed: 5,
    health_improved: 6,
    coder_approved: 10,
    coder_manual_similar: 7,
    fix_failed: -12,
    qa_failed: -10,
    health_dropped: -15,
    coder_rejected: -8,
    coder_different_fix: -5,
    rollback: -20
  };
  const reason = event.outcome || event.coderAction;
  const delta = deltas[reason] ?? 0;
  if (!delta || !event.playbookId) return null;
  const doc = readConfidenceDoc();
  if (!doc.playbooks[event.playbookId]) doc.playbooks[event.playbookId] = { score: 50, history: [] };
  const prev = doc.playbooks[event.playbookId].score;
  const next = Math.max(0, Math.min(100, prev + delta));
  doc.playbooks[event.playbookId].score = next;
  doc.playbooks[event.playbookId].history.unshift({ at: new Date().toISOString(), prev, next, delta, reason });
  doc.playbooks[event.playbookId].history = doc.playbooks[event.playbookId].history.slice(0, 100);
  doc.events = doc.events || [];
  doc.events.unshift({ at: new Date().toISOString(), ...event, score: next });
  doc.events = doc.events.slice(0, 500);
  writeConfidenceDoc(doc);
  return { prev, next, band: confidenceBand(next) };
}

function getPlaybookConfidence(playbookId) {
  if (!playbookId) return 50;
  return readConfidenceDoc().playbooks[playbookId]?.score ?? 50;
}

function confidenceBand(score) {
  if (score < 40) return 'never_auto';
  if (score < 70) return 'propose_only';
  if (score < 90) return 'guarded_auto';
  return 'fully_trusted';
}

function findPlaybook(issue) {
  const sub = String(issue?.subsystem || issue?.module || '').toLowerCase();
  const type = String(issue?.type || '').toLowerCase();
  const checkId = String(issue?.checkId || '').toLowerCase();
  for (const pb of PLAYBOOKS) {
    const subOk = !pb.subsystems?.length || pb.subsystems.some((s) => sub.includes(s) || checkId.includes(s));
    const typeOk = !pb.issueTypes?.length || pb.issueTypes.some((t) => type.includes(t) || checkId.includes(t));
    if (subOk && typeOk) return pb;
  }
  if (/feed-dedup|autoposter-dedup/.test(checkId)) return PLAYBOOKS.find((p) => p.id === 'feed-dedupe-repair');
  if (/film-sources/.test(checkId)) return PLAYBOOKS.find((p) => p.id === 'film-source-repair');
  if (/uuid/.test(checkId + type)) return PLAYBOOKS.find((p) => p.id === 'data-uuid-integrity');
  if (/autoposter|stale|no_posts/.test(checkId + type + sub)) return PLAYBOOKS.find((p) => p.id === 'autoposter-stale-force');
  if (/portal/.test(checkId + sub)) return PLAYBOOKS.find((p) => p.id === 'portal-sync-recover');
  if (/recruiting|ingest/.test(checkId + sub)) return PLAYBOOKS.find((p) => p.id === 'recruiting-ingest-recover');
  if (/war-room|scouting/.test(checkId + sub)) return PLAYBOOKS.find((p) => p.id === 'war-room-refresh');
  return null;
}

function inferFixType(patchType, checkId) {
  const pt = String(patchType || '').toLowerCase();
  const cid = String(checkId || '').toLowerCase();
  if (/feed-dedup|schema|film-source|war-room|uuid/.test(pt + cid)) return 'data';
  if (/cron|autoposter-force/.test(pt + cid)) return 'cron';
  if (/ingest|portal|recruiting|on3/.test(cid)) return 'ingest';
  if (/react|component|route|layout|ux|visual/.test(pt + cid)) return 'layout';
  return 'data';
}

function isPatchBlocked(patchType) {
  if (!isV3Enabled()) return false;
  const pt = String(patchType || '').toLowerCase();
  if (V3_ALLOWED_PATCH_TYPES.has(pt)) return false;
  return BLOCKED_PATCH_TYPES.has(pt) || /^react-/.test(pt);
}

function canProposePatch(proposal) {
  if (isPatchBlocked(proposal?.patchType)) return { ok: false, reason: 'v3_blocked_patch_type' };
  const ft = inferFixType(proposal?.patchType, proposal?.checkId);
  if (isV3OpsOnly() && ['layout', 'code'].includes(ft)) return { ok: false, reason: 'v3_layout_code_manual_only' };
  return { ok: true, fixType: ft };
}

function canAutoApply(issue, patch) {
  const mode = getModeConfig();
  if (!mode.applyPatches) return false;
  const patchType = patch?.patchType || issue?.patchType;
  if (isPatchBlocked(patchType)) return false;
  const fixType = inferFixType(patchType, issue?.checkId || patch?.checkId);
  if (!AUTO_HEAL_FIX_TYPES.has(fixType)) return false;
  const playbook = findPlaybook(issue || patch);
  const conf = getPlaybookConfidence(playbook?.id);
  if (playbook && conf < (playbook.autoHealMinConfidence ?? 90)) return false;
  const risk = patch?.riskLevel || issue?.riskLevel || playbook?.riskLevel || 'high';
  if (mode.id === 'guarded-apply') return (mode.autoRiskLevels || ['low']).includes(risk);
  if (mode.id === 'full-auto-heal') {
    const allowed = String(process.env.SELF_RUNNER_AUTO_HEAL_SUBSYSTEMS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const sub = String(playbook?.subsystems?.[0] || issue?.module || '').toLowerCase();
    if (allowed.length && !allowed.some((a) => sub.includes(a))) return false;
    return conf >= 90;
  }
  return false;
}

function shouldPropose() {
  return getModeConfig().proposePatches !== false;
}

function listPlaybooksWithConfidence() {
  return PLAYBOOKS.map((pb) => ({
    ...pb,
    confidence: getPlaybookConfidence(pb.id),
    band: confidenceBand(getPlaybookConfidence(pb.id))
  }));
}

function normalizeIssue(raw) {
  const subsystem = String(raw.subsystem || raw.module || 'unknown').toLowerCase();
  const type = String(raw.type || raw.issueType || 'unknown').toLowerCase();
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.map((e) => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).filter(Boolean).slice(0, 12)
    : raw.details
      ? [String(raw.details)]
      : [];
  return {
    id: raw.id || `issue_${subsystem}_${Date.now()}`,
    subsystem,
    type,
    severity: raw.severity || 'medium',
    fixType: inferFixType(raw.patchType, raw.checkId),
    title: raw.title || `${subsystem}: ${type}`,
    evidence,
    timestamp: raw.timestamp || new Date().toISOString(),
    checkId: raw.checkId || null,
    verified: evidence.length > 0
  };
}

async function collectV3Signals() {
  const memoryGuard = require('../pipeline-guards');
  if (memoryGuard.isMemoryUnderPressure()) return [];

  const issues = [];
  try {
    const apFresh = require('../autoposter-freshness');
    const ap = apFresh.getAutoposterStatus?.() || {};
    if (ap.status === 'red') {
      issues.push(
        normalizeIssue({
          subsystem: 'autoposter',
          type: ap.lastPostAt ? 'stale' : 'no_posts_yet',
          severity: 'high',
          evidence: [`Last post: ${ap.lastPostLabel || 'never'}`, `Queue: ${ap.queuePending ?? 0} pending`],
          checkId: 'integrity:autoposter-stale'
        })
      );
    }
  } catch {
    /* optional */
  }
  try {
    const dedupe = require('./dedupe-engine');
    const ctx = require('./context-patch-generator');
    const items = ctx.loadFeedItemsForPatch?.() || [];
    if (items.length) {
      const v = dedupe.validateFeedIntegrity(items);
      if (!v.ok) {
        issues.push(
          normalizeIssue({
            subsystem: 'feed',
            type: 'feed_integrity',
            severity: 'critical',
            evidence: v.issues.slice(0, 6).map((i) => `${i.type}: ${i.id || 'item'}`),
            checkId: 'integrity:autoposter-dedup'
          })
        );
      }
    }
  } catch {
    /* optional */
  }
  return issues.filter((i) => i.verified);
}

async function runV3Scan() {
  const signals = await collectV3Signals();
  return {
    engineVersion: '3.0.0',
    mode: currentMode(),
    scannedAt: new Date().toISOString(),
    issueCount: signals.length,
    issues: signals.map((issue) => ({
      issue,
      playbook: findPlaybook(issue),
      confidence: getPlaybookConfidence(findPlaybook(issue)?.id)
    })),
    playbooks: listPlaybooksWithConfidence()
  };
}

function enrichProposal(proposal, issue) {
  const playbook = findPlaybook(issue || proposal);
  const fixType = inferFixType(proposal?.patchType, proposal?.checkId || issue?.checkId);
  const conf = getPlaybookConfidence(playbook?.id);
  return {
    ...proposal,
    fixType,
    playbookId: playbook?.id || null,
    playbookLabel: playbook?.label || null,
    confidence: conf,
    confidenceBand: confidenceBand(conf),
    autoHealEligible: canAutoApply(issue || proposal, proposal),
    engineVersion: '3.0.0',
    v3: true
  };
}

module.exports = {
  FIX_TYPES,
  AUTO_HEAL_FIX_TYPES,
  BLOCKED_PATCH_TYPES,
  V3_ALLOWED_PATCH_TYPES,
  PLAYBOOKS,
  MODES,
  isV3Enabled,
  isV3OpsOnly,
  currentMode,
  getModeConfig,
  canAutoApply,
  shouldPropose,
  isPatchBlocked,
  canProposePatch,
  findPlaybook,
  inferFixType,
  getPlaybookConfidence,
  confidenceBand,
  listPlaybooksWithConfidence,
  normalizeIssue,
  collectV3Signals,
  runV3Scan,
  enrichProposal,
  recordLearningEvent,
  readConfidenceDoc
};
