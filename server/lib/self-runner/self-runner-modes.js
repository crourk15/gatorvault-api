/**
 * Self-Runner 2.0 — execution modes (scan-only, assisted, auto-repair).
 */

const MODES = {
  'scan-only': {
    id: 'scan-only',
    label: 'Scan Only',
    proposePatches: true,
    applyPatches: false,
    requireApproval: true,
    description: 'Detect issues, log them, propose patches — no automatic changes'
  },
  assisted: {
    id: 'assisted',
    label: 'Assisted',
    proposePatches: true,
    applyPatches: false,
    requireApproval: true,
    description: 'Propose patches; require manual Approve/Reject (default)'
  },
  'auto-repair': {
    id: 'auto-repair',
    label: 'Auto Repair',
    proposePatches: true,
    applyPatches: true,
    requireApproval: false,
    autoRiskLevels: ['low'],
    description: 'Auto-apply low-risk schema/CSS typo fixes; log everything'
  }
};

function currentMode() {
  const raw = String(process.env.SELF_RUNNER_MODE || 'assisted').toLowerCase();
  return MODES[raw] ? raw : 'assisted';
}

function getModeConfig(modeId) {
  return MODES[modeId || currentMode()] || MODES.assisted;
}

function canAutoApply(issue, patch) {
  const mode = getModeConfig();
  if (!mode.applyPatches) return false;
  const risk = patch?.riskLevel || issue?.riskLevel || 'high';
  return (mode.autoRiskLevels || []).includes(risk);
}

function shouldPropose() {
  return getModeConfig().proposePatches !== false;
}

module.exports = {
  MODES,
  currentMode,
  getModeConfig,
  canAutoApply,
  shouldPropose
};
