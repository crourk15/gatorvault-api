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

function htmlHasHook(html, hookId) {
  const hook = blueprint.html.hookByMarker(hookId);
  if (!hook) return html.includes(hookId);
  if (hook.id && html.includes(`id="${hook.id}"`)) return true;
  if (hook.marker && html.includes(hook.marker)) return true;
  if (hook.className && html.includes(hook.className)) return true;
  if (hookId === 'gvOpenTeamDetail' && html.includes('gv-team-mobile.js')) return true;
  if (hookId === 'gvOpenVerifiedSource' && html.includes('gv-film-sources.js')) return true;
  if (hookId === 'war-room-panel' && (html.includes('gv-war-room-root') || html.includes('scouting-database-content'))) return true;
  return false;
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

function buildFeedDedupPatchV2(issue) {
  return {
    patchType: 'feed-dedup-v2',
    riskLevel: 'low',
    edits: [
      {
        file: 'data/live/feed-items.json',
        type: 'dedupe-feed-smart',
        windowSec: dedupeEngine.DEFAULT_WINDOW_SEC
      }
    ],
    patchPreview: {
      file: 'data/live/feed-items.json',
      before: issue?.details?.length ? `${issue.details.length} duplicate(s)` : 'duplicate feed items',
      after: `SHA-256 dedupe within ${dedupeEngine.DEFAULT_WINDOW_SEC}s window`
    },
    suggestedFix: 'Dedupe feed items using normalized SHA-256 hashes — no placeholder hashes'
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
    return buildFeedDedupPatchV2(issue);
  }

  if (/missing-content|pages:.*hooks|integrity:filmroom/.test(checkId)) {
    const missing = scanHtmlHooks();
    if (missing.length) return buildHtmlHookPatch(missing);
  }

  if (/theme-token|css-token|layout-overflow|panel-clipping/.test(checkId)) {
    const missing = scanCssTokens();
    if (missing.length) return buildCssTokenPatchV2(missing);
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

  const hasPlaceholder = built.edits.some(
    (e) =>
      e.type === 'verify-hooks' ||
      e.type === 'verify-json' ||
      e.type === 'template-guided' ||
      /<!--\s*self-runner:/.test(e.text || '')
  );

  if (!hasPlaceholder) return built;

  const v2 = generateContextPatch(issue, {});
  if (v2) return { ...built, ...v2, supersededPlaceholder: true };

  return built;
}

module.exports = {
  htmlHasHook,
  buildHtmlHookPatch,
  buildCssTokenPatchV2,
  buildFeedDedupPatchV2,
  buildJsonFieldPatches,
  scanHtmlHooks,
  scanCssTokens,
  generateContextPatch,
  enrichLegacyPatch
};
