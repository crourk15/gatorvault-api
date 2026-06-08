const store = require('./recruiting-store');
const { runOn3Ingest, syncPortalFromOn3, getIngestStatus } = require('./on3-ingest');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { buildHeatCheck } = require('./heat-check-store');

const RECRUITING_ADMIN_PIN = process.env.RECRUITING_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';
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
        starsDisplay: p.starsDisplay || '★'.repeat(Math.min(5, parseInt(p.stars, 10) || 0))
      }));
      return res.json({
        ok: true,
        incoming,
        count: incoming.length,
        on3Source,
        headlinerSource: 'on3_commits_transfer_rows'
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
      const events = (await store.getEvents({ limit: 20 })).filter((e) => e.playerSlug === player.slug);
      return res.json({ ok: true, player, events });
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
        source: 'manual'
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
