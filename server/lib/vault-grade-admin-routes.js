const { verifyAdminPin, pinFromReq } = require('./admin-pin');
const vaultGradeService = require('./vault-grade-service');

function mountVaultGradeAdminRoutes(app) {
  app.get('/api/admin/vault-grade/search', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const q = req.query.q || req.query.query || '';
      const limit = parseInt(req.query.limit || '20', 10);
      const players = await vaultGradeService.searchPlayers(q, limit);
      return res.json({ ok: true, count: players.length, players });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/vault-grade/player/:playerId', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const resolved = await vaultGradeService.resolvePlayer(req.params.playerId);
      if (!resolved) return res.status(404).json({ ok: false, error: 'Player not found' });
      const primary = resolved.roster || resolved.recruiting;
      return res.json({
        ok: true,
        player: {
          playerId: resolved.id || resolved.slug,
          slug: resolved.slug,
          name: primary.name,
          pos: primary.pos || primary.position,
          classYear: primary.classYear || primary.class || primary.year,
          rating: primary.rating != null ? Number(primary.rating) : null,
          vaultGrade: vaultGradeService.displayVaultGrade(primary),
          ratingOverride: primary.ratingOverride != null ? Number(primary.ratingOverride) : null,
          source: resolved.source
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/admin/vault-grade/update', async (req, res) => {
    const pin = pinFromReq(req);
    const bodyPin = req.body?.adminPin;
    if (!verifyAdminPin(pin) && !verifyAdminPin(bodyPin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const playerId = req.body?.playerId || req.body?.slug || req.body?.id;
      if (!playerId) {
        return res.status(400).json({ ok: false, error: 'playerId is required' });
      }
      const clear = req.body?.clear === true || req.body?.vaultGrade === null;
      const result = await vaultGradeService.updateVaultGrade({
        playerId,
        vaultGrade: req.body?.vaultGrade,
        clear
      });
      return res.json(result);
    } catch (err) {
      if (err.code === 'not_found') return res.status(404).json({ ok: false, error: err.message });
      if (err.code === 'invalid_grade') return res.status(400).json({ ok: false, error: err.message });
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountVaultGradeAdminRoutes };
