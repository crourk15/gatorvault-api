/**
 * Self-Runner 3.0 — React-native context patch generator.
 */
const fs = require('fs');
const reactPatch = require('./react-patch-generator');
const patches = require('./self-runner-patches');
const dedupeEngine = require('./dedupe-engine');
const schemaValidator = require('./schema-validator');
const learning = require('./learning-loop');
const autoposterGuard = require('./autoposter-guard');

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
    suggestedFix: 'Repair data/live/feed-items.json — VaultLiveFeedPage reads via /api/live/dashboard'
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

/** @deprecated Monolith HTML hook scanning removed — React uses static exports. */
function scanHtmlHooks() {
  return [];
}

/** @deprecated Monolith HTML hook patches removed. */
function buildHtmlHookPatch() {
  return null;
}

/** @deprecated Use react-css-append via generateReactPatch. */
function buildCssTokenPatchV2() {
  return null;
}

function generateContextPatch(issue, checkDetails) {
  if (learning.shouldRejectPatchType(issue?.patchType)) return null;

  const checkId = issue?.checkId || '';

  const react = reactPatch.generateReactPatch(issue, checkDetails);
  if (react) return react;

  if (/feed-dedup|autoposter-dedup/.test(checkId)) {
    return buildFeedDedupPatchV2(issue, checkDetails);
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
        e.type === 'template-guided' ||
        /<!--\s*self-runner:/.test(e.text || '')
    ) || autoposterGuard.patchContainsLegacyDedupeRule(autoposterGuard.collectPatchText(built));

  if (!hasPlaceholder) return built;

  const v2 = generateContextPatch(issue, {});
  if (v2) return { ...built, ...v2, supersededPlaceholder: true };

  return built;
}

module.exports = {
  loadFeedItemsForPatch,
  summarizeIntegrityIssues,
  buildHtmlHookPatch,
  buildCssTokenPatchV2,
  buildFeedDedupPatchV2,
  buildJsonFieldPatches,
  scanHtmlHooks,
  generateContextPatch,
  enrichLegacyPatch
};
