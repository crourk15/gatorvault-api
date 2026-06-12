/**
 * Self-Runner 2.0 — context-aware patch generator (real fixes, no placeholder comments).
 */
const fs = require('fs');
const blueprint = require('./blueprint/canonical-blueprint');
const schemaValidator = require('./schema-validator');
const dedupeEngine = require('./dedupe-engine');
const learning = require('./learning-loop');
const autoposterGuard = require('./autoposter-guard');
const patches = require('./self-runner-patches');

function loadFeedItemsForPatch() {
  try {
    const raw = JSON.parse(fs.readFileSync(patches.absPath('data/live/feed-items.json'), 'utf8'));
    return Array.isArray(raw) ? raw : raw.items || raw.feed || [];
  } catch {
    return [];
  }
}

function summarizeIntegrityIssues(issues) {
  const list = Array.isArray(issues) ? issues : [];
  if (!list.length) return 'none';
  const counts = {};
  list.forEach((i) => {
    const t = i.type || 'unknown';
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, n]) => `${n}× ${type}`)
    .join(', ');
}

function htmlHasHook(html, hookId) {
  const { hookPresent } = require('../guardian/blueprint-validator');
  const section = blueprint.html.hookByMarker(hookId) || blueprint.html.HTML_HOOKS[hookId];
  if (section) return hookPresent(html, hookId, section);
  return html.includes(hookId);
}

function buildHtmlHookPatch(missingHooks) {
  const edits = [];
  const file = 'index.html';
  let html = '';
  try {
    html = fs.readFileSync(patches.absPath(file), 'utf8');
  } catch {
    return null;
  }

  missingHooks.forEach((hookId) => {
    const hook = blueprint.html.hookByMarker(hookId);
    if (!hook || htmlHasHook(html, hookId)) return;

    if (hook.anchorType === 'insert-before') {
      edits.push({
        file,
        type: 'insert-before',
        anchor: hook.anchor,
        text: hook.snippet + '\n',
        hookId
      });
      return;
    }

    if (hook.anchorType === 'inside-region' && hook.regionId) {
      edits.push({
        file,
        type: 'insert-after-region-open',
        regionId: hook.regionId,
        text: '\n' + hook.snippet + '\n',
        hookId
      });
      return;
    }

    if (hook.anchorType === 'after-opening-tag' && hook.regionId) {
      edits.push({
        file,
        type: 'insert-after-region-open',
        regionId: hook.regionId,
        text: '\n' + hook.snippet + '\n',
        hookId
      });
      return;
    }

    if (hook.anchor && html.includes(hook.anchor)) {
      edits.push({
        file,
        type: 'insert-after-anchor',
        anchor: hook.anchor,
        text: '\n' + hook.snippet + '\n',
        hookId
      });
    }
  });

  if (!edits.length) return null;

  return {
    patchType: 'html-hook-v2',
    riskLevel: 'medium',
    edits,
    patchPreview: {
      file,
      files: [file],
      before: `missing hooks: ${missingHooks.join(', ')}`,
      after: edits.map((e) => e.hookId).join(', ')
    },
    suggestedFix: `Insert real HTML section hooks: ${edits.map((e) => e.hookId).join(', ')}`
  };
}

function buildCssTokenPatchV2(missingTokens) {
  if (!missingTokens?.length) return null;
  return {
    patchType: 'css-token-v2',
    riskLevel: 'low',
    edits: [
      {
        file: 'css/gv-team.css',
        type: 'ensure-css-tokens',
        tokens: missingTokens
      }
    ],
    patchPreview: {
      file: 'css/gv-team.css',
      before: `missing tokens: ${missingTokens.join(', ')}`,
      after: missingTokens.map((t) => `${t}: ${blueprint.css.REQUIRED_TOKENS[t]}`).join('; ')
    },
    suggestedFix: 'Add missing --gv-team-* design tokens to css/gv-team.css'
  };
}

function buildFeedDedupPatchV2(issue, checkDetails) {
  const items = loadFeedItemsForPatch();
  const validation = dedupeEngine.validateFeedIntegrity(items);
  const issueList = checkDetails?.details || issue.details || validation.issues || [];
  const issueCount = Array.isArray(issueList) ? issueList.length : validation.issues.length;

  return {
    patchType: 'feed-dedup-v2',
    riskLevel: 'low',
    edits: [
      {
        file: 'data/live/feed-items.json',
        type: 'repair-feed-integrity',
        windowSec: dedupeEngine.DEFAULT_WINDOW_SEC
      }
    ],
    patchPreview: {
      file: 'data/live/feed-items.json',
      files: ['data/live/feed-items.json'],
      before: `${issueCount || validation.issues.length} integrity issue(s): ${summarizeIntegrityIssues(issueList.length ? issueList : validation.issues)}`,
      after: `validateFeedIntegrity() → repairFeedItems() — SHA-256 within ${dedupeEngine.DEFAULT_WINDOW_SEC}s`
    },
    integrity: {
      ok: validation.ok,
      count: validation.count,
      issues: (issueList.length ? issueList : validation.issues).slice(0, 8)
    },
    suggestedFix: 'Run validateFeedIntegrity() and repairFeedItems() with canonical SHA-256 hashes'
  };
}

function buildJsonFieldPatches(violations) {
  const byFile = new Map();
  violations.forEach((v) => {
    const patch = schemaValidator.buildSchemaPatch(v);
    if (!patch) return;
    const file = v.file || v.path;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(...patch.edits);
  });

  const bundles = [];
  byFile.forEach((edits, file) => {
    bundles.push({
      patchType: 'schema-field-v2',
      riskLevel: 'low',
      edits,
      patchPreview: { file, files: [file], after: `${edits.length} field fix(es)` },
      suggestedFix: `Repair schema violations in ${file}`
    });
  });
  return bundles;
}

function scanHtmlHooks() {
  const file = 'index.html';
  let html = '';
  try {
    html = fs.readFileSync(patches.absPath(file), 'utf8');
  } catch {
    return blueprint.html.REQUIRED_HOOKS;
  }
  return blueprint.html.REQUIRED_HOOKS.filter((hookId) => !htmlHasHook(html, hookId));
}

function scanCssTokens() {
  const file = 'css/gv-team.css';
  let css = '';
  try {
    css = fs.readFileSync(patches.absPath(file), 'utf8');
  } catch {
    return Object.keys(blueprint.css.REQUIRED_TOKENS);
  }
  return Object.keys(blueprint.css.REQUIRED_TOKENS).filter((t) => !css.includes(t));
}

function generateContextPatch(issue, checkDetails) {
  if (learning.shouldRejectPatchType(issue?.patchType)) return null;

  const checkId = issue?.checkId || '';

  if (/feed-dedup|autoposter-dedup/.test(checkId)) {
    return buildFeedDedupPatchV2(issue, checkDetails);
  }

  if (/missing-content|pages:.*hooks|integrity:filmroom|blueprint:html/.test(checkId)) {
    const missing = v3Repair.scanBlueprintDrift().missingHooks;
    if (missing.length) return v3Repair.proposeHtmlRepairs(missing) || contextPatch.buildHtmlHookPatch(missing);
  }

  if (/theme-token|css-token|layout-overflow|panel-clipping|blueprint:css/.test(checkId)) {
    const missing = v3Repair.scanBlueprintDrift().missingTokens;
    if (missing.length) return v3Repair.proposeCssRepairs(missing) || contextPatch.buildCssTokenPatchV2(missing);
  }

  if (/schema|integrity:roster|integrity:rankings/.test(checkId) && checkDetails?.violations) {
    const bundles = buildJsonFieldPatches(checkDetails.violations);
    return bundles[0] || null;
  }

  return null;
}

function enrichLegacyPatch(built, issue) {
  if (!built?.edits) return built;
  if (!learning.blocksPlaceholderPatches()) return built;

  const hasPlaceholder =
    built.edits.some(
      (e) =>
        e.type === 'verify-hooks' ||
        e.type === 'verify-json' ||
        e.type === 'template-guided' ||
        /<!--\s*self-runner:/.test(e.text || '')
    ) || autoposterGuard.patchContainsLegacyDedupeRule(autoposterGuard.collectPatchText(built));

  if (!hasPlaceholder) return built;

  const v2 = generateContextPatch(issue, {});
  if (v2) return { ...built, ...v2, supersededPlaceholder: true };

  return built;
}

module.exports = {
  htmlHasHook,
  loadFeedItemsForPatch,
  summarizeIntegrityIssues,
  buildHtmlHookPatch,
  buildCssTokenPatchV2,
  buildFeedDedupPatchV2,
  buildJsonFieldPatches,
  scanHtmlHooks,
  scanCssTokens,
  generateContextPatch,
  enrichLegacyPatch
};
