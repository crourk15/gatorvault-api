/**
 * Film Room Knowledge Engine API routes.
 */
const { getSessionFromReq, sessionHasTier } = require('./session-auth');
const store = require('./film-room-knowledge-store');
const validator = require('./film-room-knowledge-validator');
const engine = require('./film-room-knowledge-engine');
const filmRoom = require('./film-room-feed');

const ADMIN_PIN =
  process.env.FILM_ROOM_ADMIN_PIN ||
  process.env.WAR_ROOM_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-film-room-pin'] || req.headers['x-war-room-pin'] || req.body?.pin || req.query?.pin;
}

function requireFilmTier(req, res) {
  const session = getSessionFromReq(req);
  if (!sessionHasTier(session, 'film')) {
    res.status(403).json({ ok: false, error: 'Film tier or higher required.' });
    return false;
  }
  return true;
}

function mountFilmRoomKnowledgeRoutes(app) {
  app.get('/api/film-room/knowledge/policy', (req, res) => {
    try {
      return res.json({ ok: true, ...engine.getPolicy() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/film-room/knowledge/catalog', (req, res) => {
    try {
      return res.json({ ok: true, catalog: store.listCatalog() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/film-room/knowledge/lesson/:id', (req, res) => {
    try {
      const out = engine.renderLesson(req.params.id);
      if (!out.ok) return res.status(422).json(out);
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/film-room/knowledge/explain', (req, res) => {
    if (!requireFilmTier(req, res)) return;
    try {
      const lessonId = req.body?.lessonId || req.body?.id;
      if (!lessonId) {
        return res.status(400).json({ ok: false, error: 'lessonId required' });
      }
      const out = engine.renderLesson(lessonId);
      if (!out.ok) return res.status(422).json(out);
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/film-room/knowledge/validate', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const body = req.body || {};
      let check;
      if (body.record) {
        const sourcePolicy = require('./film-room-knowledge-source');
        check = sourcePolicy.validateSourceMetadata(body.record, { table: body.table || 'record' });
        return res.json({ ok: check.ok, ...check });
      }
      if (body.lessonId) check = validator.validateLessonId(body.lessonId);
      else if (body.conceptId) check = validator.validateConceptRow(store.getConcept(body.conceptId));
      else if (body.schemeId) check = validator.validateSchemeRow(store.getScheme(body.schemeId));
      else if (body.traitId) check = validator.validateTraitRow(store.getTrait(body.traitId));
      else if (body.opponentId) check = validator.validateOpponentRow(store.getOpponentTendency(body.opponentId));
      else check = validator.validateLessonId(body.id);
      return res.json({ ok: check.ok, ...check });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/film-room/knowledge/admin/reload', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const catalog = filmRoom.rebuildFilmRoomCatalog();
      return res.json({ ok: true, catalog: store.listCatalog(), filmRoom: catalog });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountFilmRoomKnowledgeRoutes };
