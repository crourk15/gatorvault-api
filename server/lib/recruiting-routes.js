const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const { runOn3Ingest, syncPortalFromOn3, getIngestStatus } = require('./on3-ingest');
const { runRivalsPredictionIngest, getRivalsPmStatus } = require('./rivals-prediction-ingest');
const { runBeatVisitIntelIngest, ingestManualVisitIntel } = require('./beat-visit-intel-ingest');
const { runBeatWriterIngest, ingestManualBeatVisitIntel } = require('./beat-writer-ingest');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { buildHeatCheck } = require('./heat-check-store');
const highlightsStore = require('./highlights-store');
const interviewsStore = require('./interviews-store');

const RECRUITING_ADMIN_PIN =
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.EMAIL_TEST_PIN ||
  'GV2026admin';
const INGEST_CRON_SECRET = process.env.INGEST_CRON_SECRET || RECRUITING_ADMIN_PIN;

function verifyAdminPin(pin) {
  return !!pin && pin === RECRUITING_ADMIN_PIN;
}

function mountRecruitingRoutes(app) {
  app.get('/api/recruiting/status', async (req, res) => {
    try {
      const players = await store.getAllPlayers();
      const events = await store.getEvents({ limit: 1 });
      return res.json({
        ok: true,
        storage: store.storageMode(),
        players: players.length,
        lastEventAt: events[0] ? events[0].createdAt : null
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/board', async (req, res) => {
    try {
      const classYear = parseInt(req.query.class || req.query.classYear || '2027', 10);
      const board = await store.getBoard(classYear);
      return res.json({ ok: true, ...board });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/portal', async (req, res) => {
    try {
      const portal = await store.getPortalBoard();
      const on3Source =
        portal.incoming.find((p) => p.on3Source)?.on3Source ||
        'https://www.on3.com/college/florida-gators/football/2026/commits/';
      const incoming = portal.incoming.map((p) => ({
        ...p,
        on3ProfileUrl: p.on3ProfileUrl || buildOn3ProfileUrl(p),
        starsDisplay: p.starsDisplay || '★'.repeat(Math.min(5, parseInt(p.stars, 10) || 0)),
        isHeadliner: portal.headlinerSlug === p.slug
      }));
      return res.json({
        ok: true,
        incoming,
        count: incoming.length,
        headliner: portal.headliner,
        headlinerSlug: portal.headlinerSlug,
        on3Source,
        headlinerSource: portal.headlinerSource || 'stars'
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/rankings', async (req, res) => {
    try {
      const rankings = await store.getRankings();
      return res.json({ ok: true, rankings });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/heat-check', async (req, res) => {
    try {
      const heatCheck = await buildHeatCheck({ force: req.query.force === '1' || req.query.live === '1' });
      return res.json(heatCheck);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/feed', async (req, res) => {
    try {
      const forceHeat = req.query.force === '1' || req.query.live === '1';
      const [board2027, board2026, portal, rankings, events, heatCheck] = await Promise.all([
        store.getBoard(2027),
        store.getBoard(2026),
        store.getPortalBoard(),
        store.getRankings(),
        store.getEvents({ since: req.query.since, limit: parseInt(req.query.limit || '30', 10) }),
        buildHeatCheck({ force: forceHeat })
      ]);
      return res.json({
        ok: true,
        boards: { 2027: board2027, 2026: board2026 },
        portal,
        rankings,
        events,
        heatCheck,
        ts: Date.now()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/events', async (req, res) => {
    try {
      const events = await store.getEvents({
        since: req.query.since,
        limit: parseInt(req.query.limit || '50', 10)
      });
      return res.json({ ok: true, events });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/players', async (req, res) => {
    try {
      const players = await store.getAllPlayers();
      const category = req.query.category;
      const classYear = req.query.class ? parseInt(req.query.class, 10) : null;
      let list = players;
      if (category) list = list.filter((p) => p.category === category);
      if (classYear) list = list.filter((p) => p.classYear === classYear);
      return res.json({ ok: true, players: list });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/players/:slug', async (req, res) => {
    try {
      const player = await store.getPlayerBySlug(req.params.slug);
      if (!player) return res.status(404).json({ ok: false, error: 'Player not found' });
      const storeEvents = (await store.getEvents({ limit: 20 })).filter((e) => e.playerSlug === player.slug);
      const intelItems = intelStore.getIntelForPlayer({
        playerSlug: player.slug,
        playerId: player.on3Id,
        playerName: player.name
      });
      const intelEvents = intelItems.map((i) => ({
        id: i.id,
        playerSlug: player.slug,
        eventType: i.eventType,
        title:
          i.eventType === 'official_visit'
            ? `${i.playerName || player.name} — Official Visit Scheduled`
            : i.eventType === 'unofficial_visit'
              ? `${i.playerName || player.name} — Unofficial Visit`
              : i.eventType === 'visit_cancelled' || i.eventType === 'ov_change'
                ? `${i.playerName || player.name} — OV to Florida Cancelled`
                : `${i.playerName || player.name} — ${i.status || i.eventType || 'Intel'}`,
        skinny: i.detail || '',
        detail: i.detail || '',
        createdAt: i.reportedAt || i.createdAt,
        source: i.source || 'intel',
        payload: {
          visitStart: i.visitStart,
          visitEnd: i.visitEnd,
          intelFingerprint: i.fingerprint
        }
      }));
      const events = [...intelEvents, ...storeEvents]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);
      return res.json({ ok: true, player, events });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/players/:slug', async (req, res) => {
    const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const slug = String(req.params.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
      const existing = await store.getPlayerBySlug(slug);
      const name = String(req.body.name || existing?.name || '').trim();
      if (!name) return res.status(400).json({ ok: false, error: 'Player name required' });
      const player = await store.upsertPlayer({
        ...(existing || {}),
        ...req.body,
        slug,
        name,
        classYear: req.body.classYear != null ? parseInt(req.body.classYear, 10) : existing?.classYear ?? null,
        stars: req.body.stars != null ? parseInt(req.body.stars, 10) : existing?.stars ?? 0,
        natlRank: req.body.natlRank != null ? parseInt(req.body.natlRank, 10) : existing?.natlRank ?? null,
        posRank: req.body.posRank != null ? parseInt(req.body.posRank, 10) : existing?.posRank ?? null,
        stateRank: req.body.stateRank != null ? parseInt(req.body.stateRank, 10) : existing?.stateRank ?? null,
        rating: req.body.rating != null ? Number(req.body.rating) : existing?.rating ?? null
      });
      return res.json({ ok: true, player });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/players/:slug/media', (req, res) => {
    try {
      const host = req.get('x-forwarded-host') || req.get('host');
      const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
      const base = (process.env.MEDIA_CDN_BASE || `${proto}://${host}`).replace(/\/$/, '');
      const slug = req.params.slug;
      const highlights = highlightsStore.loadClips({ baseUrl: base, playerSlug: slug });
      const interviews = interviewsStore.loadClips({ baseUrl: base, playerSlug: slug });
      return res.json({
        ok: true,
        playerSlug: slug,
        highlights,
        interviews,
        total: highlights.length + interviews.length
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/events', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
      if (!verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
      }

      const eventType = String(req.body.eventType || 'commit').toLowerCase();
      const allowed = ['commit', 'decommit', 'flip', 'portal_in', 'portal_out', 'target_update', 'ranking_change'];
      if (!allowed.includes(eventType)) {
        return res.status(400).json({ ok: false, error: 'Invalid eventType' });
      }

      if (eventType === 'ranking_change') {
        const classYear = parseInt(req.body.classYear, 10);
        if (!classYear) return res.status(400).json({ ok: false, error: 'classYear required' });
        const ranking = await store.upsertRanking({
          classYear,
          nationalRank: req.body.nationalRank,
          secRank: req.body.secRank,
          classScore: req.body.classScore,
          source: 'manual'
        });
        const event = await store.createEvent({
          playerSlug: 'class-' + classYear,
          eventType: 'ranking_change',
          title: `202${String(classYear).slice(-1)} class rankings updated`,
          detail: `National #${ranking.nationalRank} · SEC #${ranking.secRank} · Score ${ranking.classScore}`,
          skinny: `UF ${classYear} class now #${ranking.nationalRank} nationally`,
          classYear,
          source: 'manual'
        });
        return res.json({ ok: true, ranking, event });
      }

      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ ok: false, error: 'Player name required' });

      const player = {
        slug: req.body.slug || store.slugify(name),
        name,
        pos: String(req.body.pos || 'ATH').trim(),
        classYear: req.body.classYear ? parseInt(req.body.classYear, 10) : null,
        school: String(req.body.school || '').trim(),
        htWt: String(req.body.htWt || '').trim(),
        stars: parseInt(req.body.stars || '3', 10),
        rating: req.body.rating != null ? Number(req.body.rating) : null,
        natlRank: req.body.natlRank != null ? parseInt(req.body.natlRank, 10) : null,
        posRank: req.body.posRank != null ? parseInt(req.body.posRank, 10) : null,
        stateRank: req.body.stateRank != null ? parseInt(req.body.stateRank, 10) : null,
        inState: !!req.body.inState,
        category: req.body.category || (eventType.startsWith('portal') ? 'portal' : 'recruit'),
        fromSchool: req.body.fromSchool || null,
        skinny: String(req.body.skinny || '').trim(),
        profileNote: String(req.body.profileNote || req.body.detail || '').trim()
      };

      const result = await store.fireRecruitingEvent({
        eventType,
        player,
        skinny: req.body.skinny,
        detail: req.body.detail,
        source: 'manual',
        verification:
          eventType === 'decommit'
            ? {
                sourceType: req.body.sourceType || 'manual_verified',
                previousCommit: req.body.previousCommit || 'Florida',
                currentCommit: req.body.currentCommit || 'Open',
                explicitDecommit: true,
                sourceUrl: req.body.sourceUrl || null,
                detail: req.body.detail || ''
              }
            : null
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('recruiting event error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/ingest/status', async (req, res) => {
    try {
      const status = getIngestStatus();
      const yearSummary = {};
      Object.keys(status.years || {}).forEach((year) => {
        const y = status.years[year] || {};
        yearSummary[year] = {
          commitCount: Object.keys(y.commits || {}).length,
          rankings: y.rankings || null
        };
      });
      return res.json({
        ok: true,
        enabled: process.env.ON3_INGEST_ENABLED === 'true',
        intervalMs: parseInt(process.env.ON3_INGEST_INTERVAL_MS || '120000', 10),
        initialized: status.initialized,
        lastRun: status.lastRun,
        classYears: status.classYears,
        years: yearSummary,
        recentLog: status.recentLog
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/admin/purge-false-decommits', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
      if (!verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
      }
      const { runPurgeFalseDecommits } = require('./purge-false-decommits');
      const result = await runPurgeFalseDecommits();
      return res.json({
        ok: true,
        ...result,
        feedClean: result.after.falseDecommitFeedItems === 0,
        alertsClean: result.after.falseDecommitEvents === 0,
        tickerClean: result.after.falseDecommitFeedItems === 0,
        noRemainingFalseDecommits: result.clean
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/admin/clear-events', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
      if (!verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
      }
      await store.clearEvents();
      return res.json({ ok: true, cleared: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/ingest', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.get('X-Ingest-Secret') || '');
      if (pin !== INGEST_CRON_SECRET && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid ingest secret' });
      }
      const classYears = req.body.classYears
        ? String(req.body.classYears).split(',').map((y) => parseInt(y.trim(), 10)).filter(Boolean)
        : undefined;
      const result = await runOn3Ingest({
        baselineOnly: !!req.body.baselineOnly,
        classYears
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('on3 ingest error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/rivals-pm/status', async (req, res) => {
    try {
      return res.json(getRivalsPmStatus());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/rivals-pm/ingest', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.get('X-Ingest-Secret') || '');
      if (pin !== INGEST_CRON_SECRET && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid ingest secret' });
      }
      const force = req.body.force === true || req.query.force === 'true';
      const result = await runRivalsPredictionIngest({ force });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('rivals-pm ingest error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/beat-visit/ingest', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.get('X-Ingest-Secret') || '');
      if (pin !== INGEST_CRON_SECRET && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid ingest secret' });
      }
      if (req.body.row && req.body.row.playerName) {
        const result = await ingestManualVisitIntel(req.body.row);
        return res.json({ ok: true, ...result });
      }
      const force = req.body.force === true || req.query.force === 'true';
      const result = await runBeatVisitIntelIngest({ force });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('beat-visit ingest error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/beat-writer/ingest', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.get('X-Ingest-Secret') || '');
      if (pin !== INGEST_CRON_SECRET && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid ingest secret' });
      }
      if (req.body.row && req.body.row.playerName) {
        const result = await ingestManualBeatVisitIntel(req.body.row);
        return res.json({ ok: true, ...result });
      }
      const force = req.body.force === true || req.query.force === 'true';
      const result = await runBeatWriterIngest({ force });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('beat-writer ingest error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/identity/overrides', (req, res) => {
    const pin = String(req.query.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const resolver = require('./contextual-identity-resolver');
      return res.json({ ok: true, ...resolver.listManualOverrides() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/identity/overrides', (req, res) => {
    const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const resolver = require('./contextual-identity-resolver');
      const item = resolver.upsertManualOverride(req.body || {});
      return res.json({ ok: true, item });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/recruiting/identity/overrides/:id', (req, res) => {
    const pin = String(req.query.pin || req.body?.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const resolver = require('./contextual-identity-resolver');
      return res.json({ ok: true, ...resolver.deleteManualOverride(req.params.id) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/identity/resolve', async (req, res) => {
    const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const resolver = require('./contextual-identity-resolver');
      const result = await resolver.resolveContextualIdentity({
        text: req.body.text || '',
        sourceHandle: req.body.sourceHandle || null,
        hints: req.body.hints || {}
      });
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/identity/patterns', async (req, res) => {
    const pin = String(req.query.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const patternStore = require('./identity-patterns-store');
      const slug = req.query.slug || null;
      if (slug) {
        const entry = await patternStore.getPatternBySlug(slug);
        return res.json({ ok: true, entry, storage: patternStore.storageMode() });
      }
      const items = await patternStore.listAllPatterns();
      return res.json({ ok: true, count: items.length, items, storage: patternStore.storageMode() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/identity/patterns/rebuild', async (req, res) => {
    const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || '');
    if (!verifyAdminPin(pin)) return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
    try {
      const patternStore = require('./identity-patterns-store');
      const opsMonitor = require('./ops-monitor');
      const slug = String(req.body.slug || '').trim() || null;

      if (slug) {
        const recruitingStore = require('./recruiting-store');
        const player = await recruitingStore.getPlayerBySlug(slug);
        if (!player) return res.status(404).json({ ok: false, error: 'Player not found' });
        const started = Date.now();
        const entry = await patternStore.syncPatternsForPlayer(player);
        const durationMs = Date.now() - started;
        opsMonitor.logEvent({
          subsystem: 'cron:identity-patterns',
          status: 'success',
          message: `Identity patterns rebuilt for ${player.name}`,
          details: { slug, patternCount: entry?.patterns?.length || 0, durationMs, single: true }
        });
        return res.json({
          ok: true,
          slug,
          entry,
          patternCount: entry?.patterns?.length || 0,
          durationMs,
          updatedAt: entry?.updatedAt || null,
          storage: patternStore.storageMode()
        });
      }

      const started = Date.now();
      const result = await patternStore.rebuildAllPatterns();
      opsMonitor.logEvent({
        subsystem: 'cron:identity-patterns',
        status: 'success',
        message: `Identity patterns rebuilt (${result.count} players)`,
        details: { count: result.count, durationMs: result.durationMs || Date.now() - started }
      });
      return res.json({ ok: true, ...result, storage: patternStore.storageMode() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/recruiting/internal-alerts', async (req, res) => {
    try {
      const pin = String(req.query.pin || req.get('X-Recruiting-Pin') || '');
      if (pin !== INGEST_CRON_SECRET && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin pin' });
      }
      const fs = require('fs');
      const path = require('path');
      const alertsPath = path.join(__dirname, '..', 'data', 'recruiting', 'internal-alerts.json');
      let doc = { version: 1, alerts: [] };
      try {
        doc = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));
      } catch {
        /* empty */
      }
      const limit = Math.min(100, parseInt(req.query.limit || '50', 10) || 50);
      const unreadOnly = req.query.unread === 'true';
      let alerts = doc.alerts || [];
      if (unreadOnly) alerts = alerts.filter((a) => !a.read);
      return res.json({ ok: true, alerts: alerts.slice(0, limit), updatedAt: doc.updatedAt || null });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/recruiting/portal/sync', async (req, res) => {
    try {
      const pin = String(req.body.pin || req.get('X-Recruiting-Pin') || req.get('X-Ingest-Secret') || '');
      if (pin !== INGEST_CRON_SECRET && !verifyAdminPin(pin)) {
        return res.status(401).json({ ok: false, error: 'Invalid ingest secret' });
      }
      const year = req.body.year ? parseInt(req.body.year, 10) : 2026;
      const result = await syncPortalFromOn3({ classYear: year, force: true });
      const portal = await store.getPortalBoard();
      return res.json({
        ok: true,
        synced: result.updated || result.count || portal.count,
        portal,
        on3Source: result.url || null
      });
    } catch (err) {
      console.error('portal sync error', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountRecruitingRoutes, verifyAdminPin };
