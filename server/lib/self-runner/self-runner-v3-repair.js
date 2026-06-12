/**
 * Self-Runner 3.0 — HTML/CSS repair engine driven by blueprints/*.json
 */
const fs = require('fs');
const contextPatch = require('./context-patch-generator');
const blueprintValidator = require('../guardian/blueprint-validator');
const multiFile = require('./multi-file-patcher');
const loader = require('./blueprint/blueprint-loader');
const patches = require('./self-runner-patches');

function scanBlueprintDrift() {
  const html = blueprintValidator.verifyHtmlBlueprint();
  const css = blueprintValidator.verifyCssBlueprint();
  return {
    ok: html.ok && css.ok,
    missingHooks: html.missing || [],
    missingTokens: css.missingTokens || [],
    errors: [...(html.errors || []), ...(css.errors || [])]
  };
}

function proposeHtmlRepairs(missingHooks) {
  if (!missingHooks?.length) return null;
  return contextPatch.buildHtmlHookPatch(missingHooks);
}

function proposeCssRepairs(missingTokens) {
  if (!missingTokens?.length) return null;
  return contextPatch.buildCssTokenPatchV2(missingTokens);
}

function generateBlueprintRepairs() {
  const drift = scanBlueprintDrift();
  const proposals = [];
  const htmlPatch = proposeHtmlRepairs(drift.missingHooks);
  if (htmlPatch) proposals.push(htmlPatch);
  const cssPatch = proposeCssRepairs(drift.missingTokens);
  if (cssPatch) proposals.push(cssPatch);
  return { drift, proposals };
}

function applyBlueprintRepair(proposal, { dryRun = false } = {}) {
  if (!proposal?.edits?.length) return { ok: false, error: 'no_edits' };
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      preview: proposal.patchPreview,
      edits: proposal.edits.length
    };
  }
  return multiFile.applyEdits(proposal.edits, { patchType: proposal.patchType });
}

function compareIndexToBlueprint() {
  const indexPath = patches.absPath('index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const bp = loader.htmlBlueprint();
  const report = {};
  for (const hookId of bp.required || []) {
    const section = bp.sections?.[hookId];
    report[hookId] = {
      present: blueprintValidator.hookPresent(html, hookId, section),
      expectedLocation: section?.expectedLocation || null,
      canonicalId: section?.id || hookId
    };
  }
  return report;
}

function compareCssToBlueprint() {
  const cssPath = patches.absPath('css/gv-team.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const tokens = loader.requiredCssTokens();
  const report = {};
  Object.entries(tokens).forEach(([token, value]) => {
    report[token] = { present: css.includes(token), expectedValue: value };
  });
  return report;
}

module.exports = {
  scanBlueprintDrift,
  proposeHtmlRepairs,
  proposeCssRepairs,
  generateBlueprintRepairs,
  applyBlueprintRepair,
  compareIndexToBlueprint,
  compareCssToBlueprint
};
