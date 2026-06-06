const store = require('./community-store');
const { getSessionFromReq } = require('./session-auth');

const COMMUNITY_ADMIN_PIN =
  process.env.COMMUNITY_ADMIN_PIN || process.env.CONTENT_ADMIN_PIN || process.env.EMAIL_TEST_PIN || 'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === COMMUNITY_ADMIN_PIN;
}

function pinFromReq(req) {
  return req.headers['x-community-pin'] || req.body?.pin || req.query?.pin;
}

function requireSession(req, res) {
  const session = getSessionFromReq(req);
  if (!session || !session.email) {
    res.status(401).json({ ok: false, error: 'Sign in required to post in Community.' });
    return null;
  }
  return session;
}

function mountCommunityRoutes(app) {
  app.get('/api/community/categories', (req, res) => {
    try {
      return res.json({ ok: true, categories: store.ensureCategories() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/community/threads', (req, res) => {
    try {
      const sort = req.query.sort || 'trending';
      const category = req.query.category || null;
      const limit = parseInt(req.query.limit || '50', 10);
      const threads = store.getThreads({ sort, category, limit });
      const session = getSessionFromReq(req);
      const followed = session ? store.getFollowedThreadIds(session.email) : [];
      return res.json({ ok: true, threads, followed, sort });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/community/thread/:id', (req, res) => {
    try {
      const data = store.getThreadById(req.params.id, true);
      if (!data) return res.status(404).json({ ok: false, error: 'Thread not found' });
      const session = getSessionFromReq(req);
      const followed = session ? store.getFollowedThreadIds(session.email) : [];
      return res.json({
        ok: true,
        ...data,
        following: followed.includes(req.params.id)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/community/pulse', (req, res) => {
    try {
      return res.json({ ok: true, pulse: store.getPulseStats() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/community/thread', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const result = store.createThread(session, {
        title: req.body.title,
        body: req.body.body,
        categorySlug: req.body.category || req.body.categorySlug || 'locker'
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/community/thread/:id/reply', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const result = store.createReply(session, req.params.id, req.body.body || req.body.text);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/community/thread/:id/follow', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const result = store.toggleFollow(session.email, req.params.id);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/community/post/:id/flag', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const flag = store.flagPost(session, req.params.id, req.body.reason);
      return res.json({ ok: true, flag });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/community/live-rooms', (req, res) => {
    try {
      return res.json({ ok: true, rooms: store.getLiveRooms() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/community/live-rooms/:id/messages', (req, res) => {
    try {
      const messages = store.getLiveRoomMessages(req.params.id, req.query.since);
      return res.json({ ok: true, messages });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/community/live-rooms/:id/messages', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const msg = store.postLiveMessage(session, req.params.id, req.body.body || req.body.text);
      return res.json({ ok: true, message: msg });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ---- Admin ----
  app.get('/api/community/admin/queue', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      return res.json({
        ok: true,
        threads: store.getThreads({ sort: 'recent', limit: 100 }),
        flags: store.getOpenFlags(),
        categories: store.ensureCategories()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/community/admin/thread/:id/pin', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const thread = store.adminPinThread(req.params.id, req.body.pinned !== false);
    if (!thread) return res.status(404).json({ ok: false, error: 'Thread not found' });
    return res.json({ ok: true, thread });
  });

  app.post('/api/community/admin/thread/:id/lock', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const thread = store.adminLockThread(req.params.id, req.body.locked !== false);
    if (!thread) return res.status(404).json({ ok: false, error: 'Thread not found' });
    return res.json({ ok: true, thread });
  });

  app.post('/api/community/admin/thread/:id/feature', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const thread = store.adminFeatureThread(req.params.id, req.body.featured !== false);
    if (!thread) return res.status(404).json({ ok: false, error: 'Thread not found' });
    return res.json({ ok: true, thread });
  });

  app.delete('/api/community/admin/thread/:id', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const thread = store.adminDeleteThread(req.params.id);
    if (!thread) return res.status(404).json({ ok: false, error: 'Thread not found' });
    return res.json({ ok: true, thread });
  });

  app.delete('/api/community/admin/post/:id', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const post = store.adminDeletePost(req.params.id);
    if (!post) return res.status(404).json({ ok: false, error: 'Post not found' });
    return res.json({ ok: true, post });
  });

  app.post('/api/community/admin/flags/:id/resolve', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const flag = store.resolveFlag(req.params.id, req.body.status || 'resolved');
    if (!flag) return res.status(404).json({ ok: false, error: 'Flag not found' });
    return res.json({ ok: true, flag });
  });

  app.post('/api/community/admin/categories/:id', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const cat = store.adminUpdateCategory(req.params.id, req.body || {});
    if (!cat) return res.status(404).json({ ok: false, error: 'Category not found' });
    return res.json({ ok: true, category: cat });
  });
}

module.exports = { mountCommunityRoutes };
