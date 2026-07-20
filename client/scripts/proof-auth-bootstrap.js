/** Seed a war-tier session so vault auth gate allows recruiting/futurecast/film-room in proof runs. */

async function loginRemoteSession({ base, email, password, apiOrigin }) {
  // Prefer same-origin Netlify /api proxy first (avoids browser CORS + Render cold flakes),
  // then fall back to direct API origin from Node.
  const candidates = [];
  try {
    const u = new URL(base);
    candidates.push(`${u.origin}/api/login`);
  } catch {
    /* ignore */
  }
  if (apiOrigin) candidates.push(`${String(apiOrigin).replace(/\/$/, '')}/api/login`);

  let lastErr = null;
  for (const url of candidates) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body?.session?.token) {
          return { ok: true, session: body.session, via: url, attempt };
        }
        lastErr = new Error(`login HTTP ${res.status} via ${url}`);
      } catch (err) {
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return { ok: false, error: lastErr };
}

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

  const email = (process.env.PROOF_EMAIL || process.env.APP_REVIEW_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROOF_PASSWORD || process.env.APP_REVIEW_PASSWORD || '';
  const apiOrigin = process.env.API_ORIGIN || 'https://gatorvault-api.onrender.com';

  if (isRemote && email && password) {
    const login = await loginRemoteSession({ base, email, password, apiOrigin });
    if (login.ok) {
      await page.evaluate((session) => {
        localStorage.setItem('gv_session', JSON.stringify(session));
        sessionStorage.removeItem('gv_auth_handoff');
      }, login.session);
      console.log(`[proof-auth] remote login ok via ${login.via} (attempt ${login.attempt})`);
      return;
    }
    console.warn('[proof-auth] remote login failed — continuing with public seeded routes:', login.error?.message || login.error);
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
