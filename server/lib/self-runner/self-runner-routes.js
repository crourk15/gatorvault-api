/**
 * Self-Runner — admin API (PIN-protected approval gate).
 */
const path = require('path');
const queue = require('./self-runner-queue');
const engine = require('./self-runner-engine');
const apply = require('./self-runner-apply');
const deploy = require('./self-runner-deploy');
const validator = require('./self-runner-validator');
const failuresStore = require('./self-runner-failures/self-runner-failures-store');
const learning = require('./learning-loop');
const logger = require('./self-runner-logger');
const blueprint = require('./blueprint/canonical-blueprint');
const v2 = require('./self-runner-v2-engine');
const autoposterGuard = require('./autoposter-guard');
const { pinFromReq, verifyAdminPin } = require('../ops-routes');

function requireAuth(req, res) {
  const secret = pinFromReq(req);
  if (!verifyAdminPin(secret)) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

async function runApproveFlow(fixId, pin) {
  const fix = queue.getById(fixId);
  if (!fix) return { ok: false, error: 'fix_not_found' };
  if (fix.status !== 'pending') return { ok: false, error: `invalid_status_${fix.status}` };

  const safety = autoposterGuard.validatePatchSafety(fix);
  if (!safety.ok && fix.blocked !== false) {
    logger.log.guard({ fixId, blocked: safety.blocked });
    return { ok: false, error: 'patch_blocked_by_guard', blocked: safety.blocked };
  }

  queue.markStatus(fixId, 'applying', { approvedAt: new Date().toISOString(), approvedBy: 'admin' });
  learning.recordDecision({ action: 'approved', fix });
  logger.log.approve({ fixId, patchType: fix.patchType, files: fix.filesToModify });

  let applyResult;
  try {
    applyResult = apply.applyPatch(fix);
  } catch (err) {
    queue.markStatus(fixId, 'failed', { error: err.message, phase: 'apply' });
    return { ok: false, phase: 'apply', error: err.message };
  }

  const deployResult = await deploy.deployAfterPatch({
    pin,
    skipRestart: true,
    waitHealth: false
  });

  let validation;
  try {
    validation = await validator.validateFix(fix, {
      appliedFiles: applyResult?.appliedFiles || []
    });
  } catch (err) {
    queue.markStatus(fixId, 'failed', { error: err.message, phase: 'validate', applyResult, deployResult });
    return { ok: false, phase: 'validate', error: err.message, applyResult, deployResult };
  }

  if (validation.issueResolved && validation.ok !== false) {
    queue.markStatus(fixId, 'completed', {
      applyResult,
      deployResult,
      validation,
      completedAt: new Date().toISOString()
    });
    learning.recordDecision({ action: 'completed', fix });
    if (fix.sourceIssueId) engine.resolveSourceIssue(fix.sourceIssueId);
  } else {
    queue.markStatus(fixId, 'failed', {
      error: 'validation_failed_issue_still_open',
      applyResult,
      deployResult,
      validation,
      failureReport: validation.failureReport || null,
      phase: 'validate'
    });
    return {
      ok: false,
      phase: 'validate',
      applyResult,
      deployResult,
      validation,
      failureReport: validation.failureReport || null,
      escalated: true
    };
  }

  return { ok: true, applyResult, deployResult, validation };
}

function mountSelfRunnerRoutes(app) {
  const page = path.join(__dirname, '..', '..', 'admin-self-runner.html');

  app.get('/admin/self-runner', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(page);
    return res.redirect(302, '/admin#self-runner/pending');
  });

  app.get('/admin-self-runner.html', (req, res) => {
    res.sendFile(page);
  });

  app.get('/api/self-runner/blueprint', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      return res.json({ ok: true, blueprint: blueprint.platformMap() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/self-runner/logs', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const limit = Math.min(100, parseInt(req.query.limit || '50', 10) || 50);
      return res.json({ ok: true, logs: logger.listRecent(limit) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/self-runner/scan', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const enqueue = req.body?.enqueue !== false;
      const scan = enqueue
        ? await engine.runPlatformScanAndEnqueue({ includeBlueprint: !!req.body?.includeBlueprint, enqueue })
        : v2.runPlatformScan({ includeBlueprint: !!req.body?.includeBlueprint });
      return res.json({ ok: true, ...scan });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/self-runner/feedback', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      return res.json({ ok: true, feedback: learning.readFeedback() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/self-runner/health', (req, res) => {
    try {
      return res.json({ ok: true, ...engine.healthSummary() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/self-runner/pending', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const status = req.query.status || 'pending';
      const items =
        status === 'all'
          ? queue.readDoc().items || []
          : queue.listByStatus(status === 'pending' ? 'pending' : status);
      return res.json({
        ok: true,
        items,
        summary: queue.summary()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/self-runner/fix/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const fix = queue.getById(req.params.id);
      if (!fix) return res.status(404).json({ ok: false, error: 'Fix not found' });
      return res.json({ ok: true, fix });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/self-runner/failures', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const limit = Math.min(50, parseInt(req.query.limit || '20', 10) || 20);
      return res.json({ ok: true, failures: failuresStore.listFailures(limit) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/self-runner/generate', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      let qaResult = null;
      if (req.body?.runQa !== false) {
        try {
          const { runQaCrawl } = require('../qa/qa-runner');
          qaResult = await runQaCrawl({ force: true });
          console.log('[self-runner] generate: fresh QA crawl', qaResult?.run?.id, qaResult?.run?.summary);
        } catch (qaErr) {
          console.warn('[self-runner] generate: QA crawl failed, using latest run:', qaErr.message);
        }
      }
      const result = await engine.generateProposalsFromProductIntel({ logEmpty: true });
      return res.json({
        ok: true,
        ...result,
        qaCrawl: qaResult
          ? { runId: qaResult.run?.id, pass: qaResult.run?.pass, summary: qaResult.run?.summary }
          : null
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/self-runner/approve', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const id = req.body?.id;
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const pin = pinFromReq(req);
    try {
      const result = await runApproveFlow(id, pin);
      const status = result.ok ? 200 : 422;
      return res.status(status).json(result);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/self-runner/reject', (req, res) => {
    if (!requireAuth(req, res)) return;
    const id = req.body?.id;
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    try {
      const fix = queue.getById(id);
      if (!fix) return res.status(404).json({ ok: false, error: 'Fix not found' });
      if (fix.status !== 'pending') {
        return res.status(400).json({ ok: false, error: `Cannot reject fix in status ${fix.status}` });
      }
      queue.markStatus(id, 'rejected', { rejectedReason: req.body?.reason || 'admin_rejected' });
      learning.recordDecision({ action: 'rejected', fix, reason: req.body?.reason });
      logger.log.reject({ fixId: id, reason: req.body?.reason, patchType: fix.patchType });
      if (fix.sourceIssueId) {
        engine.markIssueManualReview(fix.sourceIssueId, req.body?.reason || 'Rejected — manual review required');
      }
      return res.json({ ok: true, id, status: 'rejected' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/self-runner/purge-legacy', (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const { purgeLegacyDedupeProposals } = require('./self-runner-queue-cleanup');
      const result = purgeLegacyDedupeProposals({ reject: req.body?.reject !== false });
      logger.log.info({ action: 'purge_legacy_dedupe', ...result });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log(
    '[self-runner] routes mounted: /api/self-runner/pending, /fix/:id, /failures, /scan, /blueprint, /logs, /feedback, /purge-legacy, POST /approve, /reject, /generate'
  );
}

module.exports = { mountSelfRunnerRoutes, runApproveFlow };
