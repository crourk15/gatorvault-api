/**
 * Self-Runner 2.0 — multi-file patch bundling for linked issues.
 */
const logger = require('./self-runner-logger');
const autoposterGuard = require('./autoposter-guard');

function groupKey(issue) {
  return issue?.bundleId || issue?.checkId?.split(':')[0] || issue?.category || 'general';
}

function bundleIssues(issues) {
  const groups = new Map();

  issues.forEach((item) => {
    const issue = item.issue || item;
    const patch = item.patch || item.proposedPatch;
    if (!patch?.edits?.length) return;

    const key = groupKey(issue);
    if (!groups.has(key)) {
      groups.set(key, { key, issues: [], edits: [], files: new Set(), patchTypes: new Set() });
    }
    const g = groups.get(key);
    g.issues.push(issue);
    g.edits.push(...patch.edits);
    patch.edits.forEach((e) => g.files.add(e.file));
    g.patchTypes.add(patch.patchType);
  });

  return [...groups.values()];
}

function dedupeEdits(edits) {
  const seen = new Set();
  const out = [];
  edits.forEach((edit) => {
    const sig = JSON.stringify({
      file: edit.file,
      type: edit.type,
      hookId: edit.hookId,
      field: edit.field,
      regionId: edit.regionId,
      className: edit.className
    });
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(edit);
  });
  return out;
}

function buildMultiFilePatch(group) {
  const edits = dedupeEdits(group.edits);
  const files = [...group.files];
  const proposal = {
    patchType: 'multi-file-v2',
    riskLevel: files.length > 2 ? 'medium' : 'low',
    edits,
    filesToModify: files,
    patchPreview: {
      files,
      before: group.issues.map((i) => i.checkId || i.id).join(', '),
      after: `${edits.length} edit(s) across ${files.length} file(s)`
    },
    suggestedFix: `Linked fix across ${files.join(', ')}`,
    linkedIssues: group.issues.map((i) => i.id || i.checkId),
    bundleKey: group.key
  };

  const safety = autoposterGuard.validatePatchSafety({ patch: { edits } });
  if (!safety.ok) {
    proposal.blocked = true;
    proposal.blockReason = safety.blocked;
    proposal.requiresManualApproval = true;
  }

  logger.log.multiPatch({
    bundleKey: group.key,
    files,
    edits: edits.length,
    blocked: !!proposal.blocked
  });

  return proposal;
}

function mergePatches(patches) {
  const bundled = bundleIssues(patches);
  return bundled.map(buildMultiFilePatch);
}

function combineHtmlAndJsonPatches(htmlPatch, jsonPatches) {
  if (!htmlPatch && !jsonPatches?.length) return null;
  const edits = [...(htmlPatch?.edits || [])];
  jsonPatches.forEach((p) => edits.push(...(p.edits || [])));
  const files = new Set(edits.map((e) => e.file));

  return buildMultiFilePatch({
    key: 'html-json-linked',
    issues: [{ checkId: 'blueprint:linked-structure' }],
    edits,
    files,
    patchTypes: new Set(['multi-file-v2'])
  });
}

module.exports = {
  groupKey,
  bundleIssues,
  dedupeEdits,
  buildMultiFilePatch,
  mergePatches,
  combineHtmlAndJsonPatches
};
