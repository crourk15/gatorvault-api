const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const check = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig !== check) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getSessionFromReq(req) {
  const auth = req.get('Authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token && req.body && req.body.token) token = req.body.token;
  if (!token && req.query && req.query.token) token = req.query.token;
  return verifySession(token);
}

module.exports = { verifySession, getSessionFromReq };
