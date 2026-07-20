/**
 * Admin API — Unresolved Predictions Queue.
 */
'use strict';

const { verifyAdminPin, pinFromReq } = require('./admin-pin');
const store = require('./unresolved-predictions-store');

function requireAdmin(req, res) {
  if (!verifyAdminPin(pinFromReq(req))) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

function mountUnresolvedPredictionsRoutes(app) {
  app.get('/api/admin/unresolved-predictions', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const status = String(req.query.status || 'open');
    const limit = parseInt(req.query.limit, 10) || 50;
    const listed = store.listItems({ status, limit });
    res.json({ ok: true, ...listed });
  });


  app.post('/api/admin/unresolved-predictions/enrich-open', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { enrichOpenUnresolvedPredictions } = require('./teaser-rpm-identity');
      const result = await enrichOpenUnresolvedPredictions({
        autoResolve: req.body?.autoResolve !== false,
        force: !!req.body?.force,
        limit: parseInt(req.body?.limit, 10) || 40,
        minConfidence: req.body?.minConfidence || 'high',
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/unresolved-predictions/:id/enrich', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const item = store.getItem(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: 'not_found' });
    try {
      const { enrichUnresolvedPredictionItem } = require('./teaser-rpm-identity');
      const result = await enrichUnresolvedPredictionItem(item, {
        autoResolve: req.body?.autoResolve !== false,
        minConfidence: req.body?.minConfidence || 'high',
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/unresolved-predictions/:id/resolve', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const playerSlug = String(req.body?.playerSlug || '').trim().toLowerCase() || null;
    const note = req.body?.note != null ? String(req.body.note) : null;
    const classYear = parseInt(req.body?.classYear, 10) || 2028;
    const addAllowlist = req.body?.addAllowlist !== false && !!playerSlug;

    const result = store.resolveItem(req.params.id, { playerSlug, note });
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });

    let allowlist = null;
    if (addAllowlist && playerSlug) {
      try {
        const { addToAdminAllowlist } = require('./admin-allowlist-store');
        const { CANONICAL_TARGET_NAMES } = require('./recruiting-target-allowlist');
        const name =
          String(req.body?.playerName || '').trim() ||
          CANONICAL_TARGET_NAMES[playerSlug] ||
          playerSlug
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        allowlist = addToAdminAllowlist({ slug: playerSlug, name, classYear });
      } catch (err) {
        allowlist = { added: false, error: err.message };
      }
    }

    try {
      require('./ops-monitor').logEvent({
        subsystem: 'recruiting:unresolved-predictions',
        status: 'resolved',
        message: `Resolved prediction → ${playerSlug || 'no slug'}`,
        details: { id: result.item.id, playerSlug, allowlist },
      });
    } catch {
      /* optional */
    }

    res.json({ ok: true, item: result.item, allowlist, already: !!result.already });
  });

  app.post('/api/admin/unresolved-predictions/:id/dismiss', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const note = req.body?.note != null ? String(req.body.note) : null;
    const result = store.dismissItem(req.params.id, { note });
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'recruiting:unresolved-predictions',
        status: 'dismissed',
        message: `Dismissed unresolved prediction ${result.item.id}`,
        details: { id: result.item.id },
      });
    } catch {
      /* optional */
    }
    res.json({ ok: true, item: result.item, already: !!result.already });
  });
}

module.exports = { mountUnresolvedPredictionsRoutes };
