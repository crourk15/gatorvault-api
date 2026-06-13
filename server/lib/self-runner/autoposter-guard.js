/**
 * Self-Runner 3.0 — Autoposter guard + React architecture safety rules.
 */
const reactBp = require('./blueprint/react-blueprint');
const logger = require('./self-runner-logger');
const dedupeEngine = require('./dedupe-engine');

const AUTOPOSTER_REQUIRED_FIELDS = ['name', 'pos', 'classYear', 'rating'];
const AUTOPOSTER_DATA_FILES = [
  'data/live/feed-items.json',
  'data/recruiting/players.json',
  'data/roster/players.json'
];

const CRITICAL_SECTIONS = ['Team Identity', 'Recruiting', 'Portal', 'War Room'];

const LEGACY_DEDUPE_CALL_RE = /addDedupeRule\s*\(\s*\{/;
const PLACEHOLDER_HASH_LITERAL_RE =
  /hash\s*:\s*['"](?:text-hash|normalized-text-hash|placeholder)['"]/i;
const HASH_LITERAL_RE = /hash\s*:\s*['"]([^'"]+)['"]/gi;

function collectPatchText(proposal) {
  const chunks = [];
  const edits = proposal?.patch?.edits || proposal?.edits || [];
  edits.forEach((edit) => {
    ['text', 'after', 'before', 'search', 'replacement', 'snippet'].forEach((key) => {
      if (edit[key]) chunks.push(String(edit[key]));
    });
  });
  const preview = proposal?.patchPreview || {};
  ['before', 'after', 'diff'].forEach((key) => {
    const val = preview[key];
    if (val) chunks.push(typeof val === 'string' ? val : JSON.stringify(val));
  });
  if (proposal?.codeDiffHint) chunks.push(String(proposal.codeDiffHint));
  if (proposal?.codeDiff) chunks.push(JSON.stringify(proposal.codeDiff));
  if (proposal?.template?.diff) chunks.push(JSON.stringify(proposal.template.diff));
  if (proposal?.suggestedFix) chunks.push(String(proposal.suggestedFix));
  return chunks.join('\n');
}

function patchContainsLegacyDedupeRule(text) {
  return LEGACY_DEDUPE_CALL_RE.test(text) || PLACEHOLDER_HASH_LITERAL_RE.test(text);
}

function patchContainsInvalidHashLiteral(text) {
  let match;
  HASH_LITERAL_RE.lastIndex = 0;
  while ((match = HASH_LITERAL_RE.exec(text))) {
    const hash = match[1];
    if (dedupeEngine.isPlaceholderHash(hash)) return true;
    if (!/^[a-f0-9]{64}$/i.test(hash)) return true;
  }
  return false;
}

function patchUsesLegacyDedupeEdits(edits) {
  return (edits || []).some((edit) => {
    if (edit.file?.includes('live-aggregator') && /dedupe|addDedupeRule/i.test(JSON.stringify(edit))) {
      return true;
    }
    if (edit.type === 'template-guided' && edit.ruleId === 'C1') return true;
    return false;
  });
}

function patchRemovesHook(edits) {
  const removed = [];
  (edits || []).forEach((edit) => {
    if (edit.type === 'remove-element' || edit.type === 'remove-hook') {
      removed.push(edit.marker || edit.hookId);
    }
    if (edit.type === 'replace-all' && edit.search) {
      const protectedHooks = ['data-testid="vault-', 'data-testid="landing-page"'];
      protectedHooks.forEach((hook) => {
        if (String(edit.search).includes(hook) && !(String(edit.replacement || '').includes(hook))) {
          removed.push(hook);
        }
      });
    }
  });
  return removed;
}

function patchCorruptsAutoposterData(edits) {
  const issues = [];
  (edits || []).forEach((edit) => {
    if (!AUTOPOSTER_DATA_FILES.some((f) => edit.file?.includes(f.replace('data/', '')))) return;

    if (edit.type === 'write-json' && (edit.data == null || edit.data === {})) {
      issues.push({ file: edit.file, issue: 'would_overwrite_with_empty_object' });
    }
    if (edit.type === 'json-replace-root' && edit.value === {}) {
      issues.push({ file: edit.file, issue: 'would_replace_root_with_empty' });
    }
    if (edit.type === 'dedupe-feed' && edit.mode === 'clear') {
      issues.push({ file: edit.file, issue: 'would_clear_feed_items' });
    }
  });
  return issues;
}

function validatePatchSafety(proposal) {
  const edits = proposal?.patch?.edits || proposal?.edits || [];
  const blocked = [];
  const warnings = [];

  const removedHooks = patchRemovesHook(edits);
  removedHooks.forEach((hook) => {
    blocked.push({
      severity: 'critical',
      code: 'protected_hook_removal',
      hook,
      detail: `Patch would remove protected hook: ${hook}`
    });
  });

  edits.forEach((edit) => {
    if (reactBp.isForbiddenEdit(edit)) {
      blocked.push({
        severity: 'critical',
        code: 'forbidden_monolith_edit',
        file: edit.file,
        type: edit.type,
        detail: `Monolith edit type "${edit.type}" blocked — use React component/CSS patches`
      });
    }
    if (edit.file && reactBp.isForbiddenFile(edit.file)) {
      blocked.push({
        severity: 'critical',
        code: 'forbidden_monolith_file',
        file: edit.file,
        detail: `Patch targets forbidden monolith file: ${edit.file}`
      });
    }
    if (edit.regionId && /^vpane-/.test(edit.regionId)) {
      blocked.push({
        severity: 'critical',
        code: 'forbidden_vpane_region',
        regionId: edit.regionId,
        detail: 'vpane region edits are retired — fix React vault components instead'
      });
    }
  });

  /* Retired monolith autoposter injection zones — no longer applicable */

  const dataIssues = patchCorruptsAutoposterData(edits);
  dataIssues.forEach((issue) => {
    blocked.push({
      severity: 'critical',
      code: 'autoposter_data_corruption',
      ...issue
    });
  });

  edits.forEach((edit) => {
    if (edit.text && /<!--\s*self-runner:/.test(edit.text)) {
      warnings.push({
        severity: 'high',
        code: 'placeholder_comment_patch',
        file: edit.file,
        detail: 'Patch contains placeholder self-runner comment — blocked by v2 guard'
      });
      blocked.push({
        severity: 'critical',
        code: 'placeholder_patch',
        file: edit.file,
        detail: 'Placeholder comment patches are not allowed in Self-Runner 2.0'
      });
    }
  });

  const patchText = collectPatchText(proposal);
  if (patchContainsLegacyDedupeRule(patchText)) {
    blocked.push({
      severity: 'critical',
      code: 'legacy_dedupe_rule',
      detail: 'Patch contains legacy addDedupeRule() or placeholder hash — use repair-feed-integrity instead'
    });
  }
  if (patchContainsInvalidHashLiteral(patchText)) {
    blocked.push({
      severity: 'critical',
      code: 'invalid_dedupe_hash',
      detail: 'Patch contains a non-SHA-256 hash literal — hashes must be 64-char hex from live-feed-dedup'
    });
  }
  if (patchUsesLegacyDedupeEdits(edits)) {
    blocked.push({
      severity: 'critical',
      code: 'legacy_dedupe_edit',
      detail: 'Patch edits target legacy live-aggregator dedupe rules — use data/live/feed-items.json repair'
    });
  }

  const result = {
    ok: blocked.length === 0,
    blocked,
    warnings,
    requiresManualApproval: blocked.some((b) => b.severity === 'critical') || warnings.length > 0
  };

  if (!result.ok) {
    logger.log.guard({
      fixId: proposal?.id,
      blocked: blocked.length,
      codes: blocked.map((b) => b.code)
    });
  }

  return result;
}

function validateAutoposterPlayerRecord(player) {
  const missing = AUTOPOSTER_REQUIRED_FIELDS.filter((f) => {
    const val = player?.[f] ?? player?.[f === 'classYear' ? 'classYear' : f];
    return val == null || val === '';
  });
  return { ok: !missing.length, missing, fields: AUTOPOSTER_REQUIRED_FIELDS };
}

module.exports = {
  AUTOPOSTER_REQUIRED_FIELDS,
  AUTOPOSTER_DATA_FILES,
  CRITICAL_SECTIONS,
  collectPatchText,
  patchContainsLegacyDedupeRule,
  patchContainsInvalidHashLiteral,
  patchUsesLegacyDedupeEdits,
  validatePatchSafety,
  validateAutoposterPlayerRecord,
  patchRemovesHook,
  patchCorruptsAutoposterData
};
