const { getSessionFromReq, sessionHasTier } = require('./session-auth');
const warRoom = require('./war-room-store');
const scoutingDb = require('./scouting-database');
const { buildWhitelistPayload } = require('./scouting-analysts');
const { getScoutingRefreshSignal } = require('./scouting-refresh');
const { isCycleRunning } = require('./scouting-update-engine');
const fs = require('fs');
const path = require('path');

const WAR_ROOM_ADMIN_PIN =
  process.env.WAR_ROOM_ADMIN_PIN || process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';

const REBUILD_LOG_PATH = path.join(__dirname, '..', 'data', 'war-room', 'scouting-rebuild-log.json');
const REBUILD_STATUS_PATH = path.join(__dirname, '..', 'data', 'war-room', 'scouting-rebuild-status.json');
let scoutingRebuildRunning = false;

function verifyAdminPin(pin) {
  return !!pin && pin === WAR_ROOM_ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-war-room-pin'] || req.headers['x-recruiting-pin'] || req.body?.pin || req.query?.pin;
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readRebuildSnapshot() {
  const status = readJsonFile(REBUILD_STATUS_PATH, null);
  const engineRunning = isCycleRunning();
  if (status) {
    return {
      running: scoutingRebuildRunning || engineRunning || !!status.running,
      status,
      lastRun: status.lastRun || readJsonFile(REBUILD_LOG_PATH, null)
    };
  }
  return {
    running: scoutingRebuildRunning || engineRunning,
    status: scoutingDb.readRebuildStatus(),
    lastRun: readJsonFile(REBUILD_LOG_PATH, null)
  };
}

function mountWarRoomRoutes(app) {
  app.get('/api/war-room/trusted-writers', (req, res) => {
    try {
      const whitelist = buildWhitelistPayload();
      return res.json({
        ok: true,
        ...whitelist,
        writers: warRoom.TRUSTED_WRITERS.map((w) => ({ id: w.id, name: w.name }))
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/war-room/refresh-signal', (req, res) => {
    try {
      return res.json({
        ok: true,
        scoutingRefreshSignal: getScoutingRefreshSignal(),
        rebuildStatus: scoutingDb.readRebuildStatus()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/war-room/scouting-database', (req, res) => {
    try {
      const session = getSessionFromReq(req);
      if (!sessionHasTier(session, 'war')) {
        return res.json({ ok: true, locked: true, tier: 'war', entries: [] });
      }
      const playerType = req.query.playerType ? String(req.query.playerType).toLowerCase() : null;
      const entries = scoutingDb.listForApi({ playerType });
      return res.json({ ok: true, count: entries.length, entries });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/war-room/admin/rebuild-scouting/status', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const snap = readRebuildSnapshot();
      return res.json({
        ok: true,
        running: snap.running,
        status: snap.status,
        lastRun: snap.lastRun
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/war-room/admin/rebuild-scouting', (req, res) => {
    console.log('[scouting] POST /api/war-room/admin/rebuild-scouting received');

    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) {
      console.warn('[scouting] rebuild rejected — invalid admin PIN');
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }

    if (scoutingRebuildRunning || isCycleRunning()) {
      console.log('[scouting] rebuild already in progress');
      return res.json({ ok: true, running: true, message: 'Scouting rebuild already in progress' });
    }

    let playerCount = 0;
    try {
      playerCount = scoutingDb.collectAllPlayers().length;
      scoutingDb.writeRebuildStatus({
        running: true,
        phase: 'starting',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        progress: { index: 0, total: playerCount, slug: null },
        lastRun: null
      });
    } catch (err) {
      console.error('[scouting] rebuild failed before start:', err.message);
      scoutingDb.writeRebuildStatus({
        running: false,
        phase: 'error',
        finishedAt: new Date().toISOString(),
        error: err.message,
        progress: null
      });
      return res.status(500).json({ ok: false, error: err.message });
    }

    scoutingRebuildRunning = true;
    console.log('[scouting] rebuild started —', playerCount, 'players');

    res.json({
      ok: true,
      started: true,
      message: `Scouting database rebuild started (${playerCount} players)`,
      total: playerCount
    });

    scoutingDb
      .rebuildScoutingDatabase({
        delayMs: parseInt(process.env.SCOUTING_REBUILD_DELAY_MS || '400', 10),
        reason: 'manual_admin_refresh'
      })
      .then((result) => {
        console.log(
          '[scouting] rebuild finished — updated',
          result.updated,
          'unchanged',
          result.unchanged,
          'blank',
          result.blank,
          'errors',
          (result.errors || []).length
        );
      })
      .catch((err) => {
        console.error('[scouting] rebuild failed:', err.message);
        scoutingDb.writeRebuildStatus({
          running: false,
          phase: 'error',
          finishedAt: new Date().toISOString(),
          error: err.message
        });
      })
      .finally(() => {
        scoutingRebuildRunning = false;
      });
  });

  app.get('/api/war-room/breakdown/:slug', (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'Player slug required' });

      const session = getSessionFromReq(req);
      if (!sessionHasTier(session, 'war')) {
        return res.json(warRoom.buildLockedResponse(slug));
      }

      return res.json(warRoom.buildBreakdownResponse(slug));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/war-room/breakdowns', (req, res) => {
    try {
      const session = getSessionFromReq(req);
      const all = warRoom.getScoutingDatabaseList();
      if (!sessionHasTier(session, 'war')) {
        return res.json({
          ok: true,
          locked: true,
          tier: 'war',
          count: all.length,
          breakdowns: all.map((b) => ({
            ...b,
            locked: true
          }))
        });
      }

      const playerType = req.query.playerType ? String(req.query.playerType).toLowerCase() : null;
      let list = all;
      if (playerType) list = list.filter((b) => b.playerType === playerType);

      return res.json({
        ok: true,
        locked: false,
        count: list.length,
        breakdowns: list
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/war-room/breakdown/:slug', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slug = String(req.params.slug || '').trim();
      const entry = warRoom.upsertBreakdown(slug, { ...req.body, playerSlug: slug });
      return res.json({ ok: true, breakdown: entry });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/war-room/breakdown/:slug', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slug = String(req.params.slug || '').trim();
      const removed = warRoom.deleteBreakdown(slug);
      if (!removed) return res.status(404).json({ ok: false, error: 'Breakdown not found' });
      return res.json({ ok: true, removed: true, playerSlug: slug });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountWarRoomRoutes, verifyAdminPin };
