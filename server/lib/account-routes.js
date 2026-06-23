const { getSessionFromReq, isAdminAccount } = require('./session-auth');
const { findUserByEmail } = require('./user-store');
const { verifyPassword } = require('./password-auth');
const { deleteAccountForUser } = require('./account-service');
const { hasPaidAccess } = require('./subscription-service');

function mountAccountRoutes(app) {
  app.post('/api/account/delete', (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.email) {
      return res.status(401).json({ ok: false, error: 'Sign in to delete your account.' });
    }

    const email = String(session.email).trim().toLowerCase();
    if (isAdminAccount(email)) {
      return res.status(403).json({
        ok: false,
        error: 'Operator accounts cannot be self-deleted. Contact platform support.',
      });
    }

    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm || '').trim();
    if (!password) {
      return res.status(400).json({ ok: false, error: 'Enter your password to confirm deletion.' });
    }
    if (confirm !== 'DELETE') {
      return res.status(400).json({ ok: false, error: 'Type DELETE in the confirmation field.' });
    }

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Incorrect password.' });
    }

    const hadPaidAccess = hasPaidAccess(user);
    const result = deleteAccountForUser(email);
    if (!result.ok) {
      return res.status(result.error === 'Account not found.' ? 404 : 500).json(result);
    }

    return res.json({
      ok: true,
      deleted: true,
      email,
      hadPaidAccess,
      message:
        'Your account has been deleted. Sign-in credentials and profile data have been removed from GatorVault.',
    });
  });
}

module.exports = { mountAccountRoutes };
