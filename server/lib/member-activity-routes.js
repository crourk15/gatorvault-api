/**
 * Logged-in member page ping — not admin-PIN gated.
 */
'use strict';

const { getSessionFromReq } = require('./session-auth');
const { findUserByEmail } = require('./user-store');
const { recordFromReq, sanitizeActivityPath } = require('./member-activity-store');

function mountMemberActivityRoutes(app) {
  app.post('/api/member-activity/ping', (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.email) {
      return res.status(401).json({ ok: false, error: 'Sign in required.' });
    }
    try {
      const pathKey = sanitizeActivityPath(req.body?.path);
      if (!pathKey) {
        return res.status(200).json({ ok: true, recorded: false, reason: 'path' });
      }
      const user = findUserByEmail(session.email);
      const result = recordFromReq(req, {
        email: session.email,
        name: user?.name || session.name || null,
        path: pathKey,
        client: req.body?.client,
      });
      return res.status(200).json({ ok: true, recorded: Boolean(result.recorded) });
    } catch (err) {
      console.warn('member-activity ping failed', err?.message || err);
      return res.status(200).json({ ok: true, recorded: false });
    }
  });
}

module.exports = { mountMemberActivityRoutes };
