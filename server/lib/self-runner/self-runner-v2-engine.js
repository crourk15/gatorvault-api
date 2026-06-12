/**
 * Self-Runner 2.0 — platform brain orchestrator.
 */
const crypto = require('crypto');
const blueprint = require('./blueprint/canonical-blueprint');
const schemaValidator = require('./schema-validator');
const contextPatch = require('./context-patch-generator');
const multiFile = require('./multi-file-patcher');
const warRoom = require('./war-room-intelligence');
const autoposterGuard = require('./autoposter-guard');
const learning = require('./learning-loop');
const modes = require('./self-runner-modes');
const logger = require('./self-runner-logger');
const queue = require('./self-runner-queue');
const dedupeEngine = require('./dedupe-engine');
const v3Repair = require('./self-runner-v3-repair');

function scanId() {
  return `sr2_scan_${crypto.randomBytes(4).toString('hex')}`;
}

function issueFromViolation(v, source) {
  return {
    id: `sr2_${source}_${crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 10)}`,
    checkId: `blueprint:${source}:${v.issue || v.field || 'unknown'}`,
    module: 'self-runner-v2',
    category: source,
    severity: v.severity || 'medium',
    title: v.detail || v.issue || `${source} violation`,
    details: [v],
    suggestedFix: v.detail || null,
    source: 'self-runner-v2'
  };
}

function scanFeedIntegrity() {
  const items = contextPatch.loadFeedItemsForPatch?.() || [];
  if (!items.length) return { issues: [], validation: { ok: true, issues: [], count: 0 } };
  const validation = dedupeEngine.validateFeedIntegrity(items);
  if (validation.ok) return { issues: [], validation };
  return {
    issues: [
      issueFromViolation(
        {
          severity: 'critical',
          issue: 'feed_integrity',
          detail: `${validation.issues.length} feed integrity issue(s): ${validation.issues
            .slice(0, 4)
            .map((i) => i.type)
            .join(', ')}`,
          checkId: 'integrity:autoposter-dedup',
          violations: validation.issues.slice(0, 12)
        },
        'feed-dedup'
      )
    ],
    validation
  };
}
function scanHtmlBlueprint() {
  const drift = v3Repair.scanBlueprintDrift();
  const missing = drift.missingHooks || [];
  if (!missing.length) return [];
  return [
    issueFromViolation(
      {
        severity: 'high',
        issue: 'missing_html_hooks',
        detail: `Missing required hooks: ${missing.join(', ')}`,
        hooks: missing,
        repairEngine: 'self-runner-v3'
      },
      'html'
    )
  ];
}

function scanCssBlueprint() {
  const drift = v3Repair.scanBlueprintDrift();
  const missing = drift.missingTokens || [];
  if (!missing.length) return [];
  return [
    issueFromViolation(
      {
        severity: 'medium',
        issue: 'missing_css_tokens',
        detail: `Missing CSS tokens: ${missing.join(', ')}`,
        tokens: missing,
        repairEngine: 'self-runner-v3'
      },
      'css'
    )
  ];
}

function runPlatformScan(opts = {}) {
  const id = scanId();
  const startedAt = new Date().toISOString();
  logger.log.scan({ scanId: id, mode: modes.currentMode() });

  const schema = schemaValidator.validateAllDataFiles();
  const feedIntegrity = scanFeedIntegrity();
  const htmlIssues = scanHtmlBlueprint();
  const cssIssues = scanCssBlueprint();
  const warRoomIntel = warRoom.runWarRoomIntelligence();

  const allIssues = [
    ...feedIntegrity.issues,
    ...htmlIssues,
    ...cssIssues,
    ...schema.violations.map((v) => issueFromViolation(v, 'schema')),
    ...warRoomIntel.violations.map((v) => issueFromViolation(v, 'war-room'))
  ];

  allIssues.forEach((issue) => logger.log.issue({ scanId: id, checkId: issue.checkId, severity: issue.severity }));

  const rawPatches = [];

  if (feedIntegrity.issues.length) {
    const feedPatch = contextPatch.buildFeedDedupPatchV2(
      { checkId: 'integrity:autoposter-dedup', details: feedIntegrity.validation.issues },
      { details: feedIntegrity.validation.issues }
    );
    if (feedPatch) rawPatches.push({ issue: feedIntegrity.issues[0], patch: feedPatch });
  }

  if (htmlIssues.length) {
    const missing = contextPatch.scanHtmlHooks();
    const htmlPatch = contextPatch.buildHtmlHookPatch(missing);
    if (htmlPatch) rawPatches.push({ issue: htmlIssues[0], patch: htmlPatch });
  }

  if (cssIssues.length) {
    const cssPatch = contextPatch.buildCssTokenPatchV2(contextPatch.scanCssTokens());
    if (cssPatch) rawPatches.push({ issue: cssIssues[0], patch: cssPatch });
  }

  schema.violations.slice(0, 20).forEach((v) => {
    const p = schemaValidator.buildSchemaPatch(v);
    if (p) rawPatches.push({ issue: issueFromViolation(v, 'schema'), patch: p });
  });

  warRoomIntel.patches.forEach((p, i) => {
    rawPatches.push({
      issue: issueFromViolation({ issue: 'war_room_maintenance', detail: p.suggestedFix }, 'war-room'),
      patch: p
    });
  });

  const multiPatches = multiFile.mergePatches(rawPatches);
  const safePatches = multiPatches.filter((p) => {
    const safety = autoposterGuard.validatePatchSafety({ patch: p });
    if (!safety.ok) {
      p.blocked = true;
      p.blockReason = safety.blocked;
      p.requiresManualApproval = true;
    }
    if (learning.shouldRejectPatchType(p.patchType)) return false;
    return true;
  });

  safePatches.forEach((p) => logger.log.patch({ scanId: id, patchType: p.patchType, files: p.filesToModify }));

  const summary = {
    scanId: id,
    mode: modes.currentMode(),
    startedAt,
    finishedAt: new Date().toISOString(),
    blueprintVersion: blueprint.VERSION,
    issueCount: allIssues.length,
    patchCount: safePatches.length,
    blockedPatchCount: multiPatches.filter((p) => p.blocked).length,
    schemaCritical: schema.criticalCount,
    staleScouting: warRoomIntel.stale.length,
    missingWarRoomCards: warRoomIntel.missing.length,
    issues: allIssues,
    patches: safePatches,
    platformMap: opts.includeBlueprint ? blueprint.platformMap() : undefined
  };

  logger.log.scan({ scanId: id, finished: true, issueCount: summary.issueCount, patchCount: summary.patchCount });
  return summary;
}

function existingPendingForCheck(checkId, patchType) {
  return (queue.readDoc().items || []).find(
    (i) =>
      (i.checkId === checkId || i.sourceIssueId === checkId) &&
      i.patchType === patchType &&
      ['pending', 'approved', 'applying'].includes(i.status)
  );
}

function enqueueProposalsFromScan(scan, { startSeq = 1 } = {}) {
  const created = [];
  let seq = startSeq;

  (scan.patches || []).forEach((patch) => {
    if (patch.blocked && modes.currentMode() !== 'scan-only') {
      logger.log.guard({ scanId: scan.scanId, patchType: patch.patchType, blocked: true });
      return;
    }
    const issue =
      scan.issues.find((i) => patch.linkedIssues?.includes(i.id)) ||
      scan.issues.find((i) => i.category === 'html') ||
      scan.issues[0];
    const checkId = issue?.checkId || `blueprint:v2:${patch.patchType}`;
    if (existingPendingForCheck(checkId, patch.patchType)) return;

    const proposal = proposalFromV2Patch(patch, issue, seq);
    queue.addPending(proposal);
    created.push(proposal);
    logger.log.patch({ scanId: scan.scanId, action: 'enqueued', fixId: proposal.id, patchType: proposal.patchType });
    seq += 1;
  });

  if (created.length) {
    let doc = queue.readDoc();
    doc = queue.appendLog(doc, {
      action: 'v2_enqueue',
      scanId: scan.scanId,
      created: created.length
    });
    queue.writeDoc(doc);
  }

  return { created, pending: queue.listByStatus('pending').length };
}

async function maybeAutoApplyFromScan(scan) {
  if (modes.currentMode() !== 'auto-repair') return { applied: [], skipped: [] };
  const apply = require('./self-runner-apply');
  const applied = [];
  const skipped = [];

  for (const patch of scan.patches || []) {
    if (!modes.canAutoApply({}, patch)) {
      skipped.push({ patchType: patch.patchType, reason: 'risk_level' });
      continue;
    }
    const safety = autoposterGuard.validatePatchSafety({ patch });
    if (!safety.ok) {
      skipped.push({ patchType: patch.patchType, reason: 'guard_blocked' });
      continue;
    }
    try {
      const fix = proposalFromV2Patch(patch, scan.issues[0], 0);
      const result = apply.applyPatch(fix);
      applied.push({ patchType: patch.patchType, result });
      logger.log.apply({ scanId: scan.scanId, patchType: patch.patchType, auto: true });
      learning.recordDecision({ action: 'completed', fix: { ...fix, patchType: patch.patchType } });
    } catch (e) {
      skipped.push({ patchType: patch.patchType, reason: e.message });
      logger.log.error('auto_repair_failed', { patchType: patch.patchType, detail: e.message });
    }
  }

  return { applied, skipped };
}

async function runPlatformScanAndEnqueue(opts = {}) {
  const scan = runPlatformScan(opts);
  const enqueue = opts.enqueue !== false && modes.currentMode() !== 'scan-only';
  let enqueueResult = { created: [], pending: queue.listByStatus('pending').length };
  let autoResult = { applied: [], skipped: [] };

  if (enqueue) {
    const startSeq = (queue.readDoc().items || []).length + 1;
    enqueueResult = enqueueProposalsFromScan(scan, { startSeq });
  }

  if (modes.currentMode() === 'auto-repair') {
    autoResult = await maybeAutoApplyFromScan(scan);
  }

  return { ...scan, enqueue: enqueueResult, autoRepair: autoResult };
}

function proposalFromV2Patch(patch, issue, seq) {
  const safety = autoposterGuard.validatePatchSafety({ patch });
  return {
    id: `sr_fix_${String(seq).padStart(3, '0')}`,
    sourceIssueId: issue?.id,
    checkId: issue?.checkId || 'blueprint:v2',
    title: issue?.title || patch.suggestedFix,
    module: 'self-runner-v2',
    classification: issue?.category || 'blueprint',
    severity: issue?.severity || 'medium',
    impact: 'platform-integrity',
    status: safety.ok && !patch.requiresManualApproval ? 'pending' : 'pending',
    patchType: patch.patchType,
    patchPreview: patch.patchPreview,
    patch: { edits: patch.edits },
    filesToModify: patch.filesToModify || patch.patchPreview?.files || [],
    suggestedFix: patch.suggestedFix,
    description: patch.suggestedFix,
    riskLevel: patch.riskLevel || 'medium',
    blocked: patch.blocked || !safety.ok,
    blockReason: patch.blockReason || safety.blocked,
    requiresManualApproval: patch.requiresManualApproval || safety.requiresManualApproval,
    bundleKey: patch.bundleKey || null,
    linkedIssues: patch.linkedIssues || [],
    createdAt: new Date().toISOString(),
    v2: true
  };
}

module.exports = {
  runPlatformScan,
  runPlatformScanAndEnqueue,
  enqueueProposalsFromScan,
  maybeAutoApplyFromScan,
  proposalFromV2Patch,
  scanHtmlBlueprint,
  scanCssBlueprint
};
