/**
 * Remove or reject Self-Runner queue items that reference legacy dedupe templates.
 */
const autoposterGuard = require('./autoposter-guard');
const queue = require('./self-runner-queue');

function isLegacyDedupeProposal(item) {
  if (!item) return false;
  const text = autoposterGuard.collectPatchText(item);
  if (autoposterGuard.patchContainsLegacyDedupeRule(text)) return true;
  if (autoposterGuard.patchContainsInvalidHashLiteral(text)) return true;
  if (autoposterGuard.patchUsesLegacyDedupeEdits(item?.patch?.edits || item?.edits || [])) return true;
  if (item.patchType === 'autoposter-dedup') return true;
  const files = item.filesToModify || item.patchPreview?.files || [];
  if (
    files.some((f) => String(f).includes('live-aggregator')) &&
    /dedupe|autoposter/i.test(`${item.checkId || ''} ${item.patchType || ''}`)
  ) {
    return true;
  }
  return false;
}

function purgeLegacyDedupeProposals({ reject = true } = {}) {
  const doc = queue.readDoc();
  const items = doc.items || [];
  const kept = [];
  const removed = [];

  items.forEach((item) => {
    if (isLegacyDedupeProposal(item)) {
      removed.push({
        id: item.id,
        checkId: item.checkId,
        patchType: item.patchType,
        status: item.status
      });
      if (reject && ['pending', 'approved'].includes(item.status)) {
        queue.markStatus(item.id, 'rejected', {
          rejectedReason: 'legacy_dedupe_template_removed',
          rejectedAt: new Date().toISOString()
        });
      }
      return;
    }
    kept.push(item);
  });

  if (removed.length) {
    doc.items = kept;
    queue.appendLog(doc, {
      action: 'purge_legacy_dedupe',
      removedCount: removed.length,
      removed: removed.slice(0, 20)
    });
    queue.writeDoc(doc);
  }

  return { removedCount: removed.length, removed, remaining: kept.length };
}

module.exports = {
  isLegacyDedupeProposal,
  purgeLegacyDedupeProposals
};
