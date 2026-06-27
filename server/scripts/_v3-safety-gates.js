/**
 * Self-Runner v3 — Safety gates and execution modes.
 */
const { normalizeFixType } = require('./issue-model');
const { isAutoHealEligible } = require('./playbook-registry');
const { getPlaybookConfidence } = require('./confidence-model');

const MODES = {
  'scan-only': {
    id: 'scan-only',
    label: 'Scan Only',
    propose: true,
    apply: false,
    requireApproval: true,
    description: 'Detect, diagnose, propose — no changes'
  },
  assisted: {
    id: 'assisted',
    label: 'Assisted',
    propose: true,
    apply: false,
    requireApproval: true,
    description: 'Propose fixes; manual Approve/Reject (legacy default)'
  },
  'guarded-apply': {
    id: 'guarded-apply',
    label: 'Guarded Apply',
    propose: true,
    apply: true,
    requireApproval: false,
    guardedOnly: true,
    verifyAfterApply: true,
    rollbackOnRegression: true,
    description: 'Auto-apply low-risk reversible ops fixes with QA verification + rollback'
  },
  'full-auto-heal': {
    id: 'full-auto-heal',
    label: 'Full Auto-Heal',
    propose: true,
    apply: true,
    requireApproval: false,
    subsystemOptIn: true,
    verifyAfterApply: true,
    rollbackOnRegression: true,
    description: 'Trusted playbooks only — opt-in per subsystem'
  }
};

const AUTO_HEAL_FIX_TYPES = new Set(['data', 'config', 'cron', 'ingest']);
const BLOCKED_PATCH_TYPES = new Set([
  'html-hook',
  'html-hook-v2',
  'ensure-team-shell',
  'background-theme',
  'missing-content',
  'team-content',
  'component-variant',
  'react-component',
  'react-route',
  'react-component-review',
  'react-route-verify',
  'layout-overflow',
  'panel-layering',
  'ordering-fix'
]);

function currentMode() {
  const raw = String(process.env.SELF_RUNNER_MODE || 'scan-only').toLowerCase();
  if (raw === 'auto-repair') return 'guarded-apply';
  return MODES[raw] ? raw : 'scan-only';
}

function getModeConfig(modeId) {
  return MODES[modeId || currentMode()] || MODES['scan-only'];
}

function isFixTypeAutoEligible(fixType) {
  return AUTO_HEAL_FIX_TYPES.has(normalizeFixType(fixType));
}

function isPatchTypeBlocked(patchType) {
  return BLOCKED_PATCH_TYPES.has(String(patchType || '').toLowerCase());
}

function canProposeFix(proposal) {
  if (isPatchTypeBlocked(proposal?.patchType)) return { ok: false, reason: 'blocked_patch_type' };
  if (['layout', 'code'].includes(normalizeFixType(proposal?.fixType))) {
    return { ok: false, reason: 'layout_code_propose_only' };
  }
  return { ok: true };
}

function canAutoApply(proposal, playbook, opts = {}) {
  const mode = getModeConfig(opts.mode);
  if (!mode.apply) return { ok: false, reason: 'mode_scan_or_assisted' };
  if (isPatchTypeBlocked(proposal?.patchType)) return { ok: false, reason: 'blocked_patch_type' };
  if (!isFixTypeAutoEligible(proposal?.fixType)) return { ok: false, reason: 'fix_type_not_auto_eligible' };

  const confidence = getPlaybookConfidence(playbook?.id || proposal?.playbookId || '');
  if (!isAutoHealEligible(playbook, confidence)) return { ok: false, reason: 'confidence_too_low', confidence };

  if (mode.id === 'guarded-apply') {
    if ((proposal?.riskLevel || playbook?.riskLevel) !== 'low') return { ok: false, reason: 'not_low_risk' };
    if (playbook?.reversible === false) return { ok: false, reason: 'not_reversible' };
    return { ok: true, mode: mode.id, confidence };
  }

  if (mode.id === 'full-auto-heal') {
    const subsystems = process.env.SELF_RUNNER_AUTO_HEAL_SUBSYSTEMS || '';
    const allowed = subsystems.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const sub = String(proposal?.subsystem || playbook?.subsystems?.[0] || '').toLowerCase();
    if (allowed.length && !allowed.some((a) => sub.includes(a))) return { ok: false, reason: 'subsystem_not_opted_in' };
    if (confidence < 90) return { ok: false, reason: 'requires_fully_trusted' };
    return { ok: true, mode: mode.id, confidence };
  }

  return { ok: false, reason: 'unknown_mode' };
}

module.exports = {
  MODES,
  AUTO_HEAL_FIX_TYPES,
  BLOCKED_PATCH_TYPES,
  currentMode,
  getModeConfig,
  isFixTypeAutoEligible,
  isPatchTypeBlocked,
  canProposeFix,
  canAutoApply
};
