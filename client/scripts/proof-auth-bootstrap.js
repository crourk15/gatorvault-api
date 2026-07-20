/** Seed a war-tier session so vault auth gate allows recruiting/futurecast/film-room in proof runs. */
async function seedProofAuth(page, base) {
  await page.goto(`${base}/vault/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const isRemote = (() => {
    try {
      const u = new URL(base);
      return u.protocol === 'https:' || (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost');
    } catch {
      return false;
    }
  })();

  // Production / remote: log in with review credentials when available so
  // verifyStoredSession does not clear a fake local token.
  const email = (process.env.PROOF_EMAIL || process.env.APP_REVIEW_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROOF_PASSWORD || process.env.APP_REVIEW_PASSWORD || '';
  const apiOrigin = process.env.API_ORIGIN || 'https://gatorvault-api.onrender.com';

  if (isRemote && email && password) {
    try {
      const login = await page.evaluate(
        async ({ apiOrigin: origin, email: em, password: pw }) => {
          const res = await fetch(`${origin}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email: em, password: pw }),
          });
          const body = await res.json().catch(() => ({}));
          return { ok: res.ok, body };
        },
        { apiOrigin, email, password }
      );
      if (login.ok && login.body?.session?.token) {
        await page.evaluate((session) => {
          localStorage.setItem('gv_session', JSON.stringify(session));
          sessionStorage.removeItem('gv_auth_handoff');
        }, login.body.session);
        return;
      }
      console.warn('[proof-auth] remote login failed — continuing with public seeded routes');
    } catch (err) {
      console.warn('[proof-auth] remote login error:', err?.message || err);
    }
  }

  // Local Netlify mirror: synthetic token is enough for VaultRouteGate.
  if (!isRemote) {
    await page.evaluate(() => {
      localStorage.setItem(
        'gv_session',
        JSON.stringify({
          token: 'local-mobile-proof',
          email: 'proof@gatorvaultinsider.com',
          tier: 'war',
        })
      );
      sessionStorage.removeItem('gv_auth_handoff');
    });
    return;
  }

  // Remote without credentials: leave guest session — seeded public routes still prove.
  await page.evaluate(() => {
    localStorage.removeItem('gv_session');
    sessionStorage.removeItem('gv_auth_handoff');
  });
}

module.exports = { seedProofAuth };
