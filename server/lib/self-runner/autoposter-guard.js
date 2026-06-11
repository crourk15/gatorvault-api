/**
 * Self-Runner 2.0 — Autoposter / War Room / Team Identity protection guard.
 */
const blueprint = require('./blueprint/canonical-blueprint');
const logger = require('./self-runner-logger');

const AUTOPOSTER_REQUIRED_FIELDS = ['name', 'pos', 'classYear', 'rating'];
const AUTOPOSTER_DATA_FILES = [
  'data/live/feed-items.json',
  'data/recruiting/players.json',
  'data/roster/players.json'
];

const CRITICAL_SECTIONS = ['Team Identity', 'Recruiting', 'Portal', 'War Room'];

function patchRemovesHook(edits) {
  const removed = [];
  (edits || []).forEach((edit) => {
    if (edit.type === 'remove-element' || edit.type === 'remove-hook') {
      removed.push(edit.marker || edit.hookId);
    }
    if (edit.type === 'replace-all' && edit.search) {
      blueprint.html.PROTECTED_HOOKS.forEach((hook) => {
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

  blueprint.html.AUTOPOSTER_INJECTION_ZONES.forEach((zone) => {
    edits.forEach((edit) => {
      if (edit.type === 'remove-element' && edit.marker === zone) {
        blocked.push({
          severity: 'critical',
          code: 'autoposter_zone_removal',
          zone,
          detail: `Patch would remove Autoposter injection zone: ${zone}`
        });
      }
    });
  });

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
  validatePatchSafety,
  validateAutoposterPlayerRecord,
  patchRemovesHook,
  patchCorruptsAutoposterData
};
