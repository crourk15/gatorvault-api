/** Seed a war-tier session so vault auth gate allows recruiting/futurecast/film-room in proof runs. */

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function warmApi(apiOrigin) {
  const ping = String(apiOrigin).replace(/\/$/, "") + "/api/ping";
  for (let i = 1; i <= 8; i += 1) {
    try {
      const res = await fetch(ping, { headers: { Accept: "application/json" } });
      if (res.ok) return true;
    } catch (_) {}
    await sleep(2000 * i);
  }
  return false;
}

async function loginRemoteSession({ base, email, password, apiOrigin }) {
  const candidates = [];
  try {
    const u = new URL(base);
    candidates.push(u.origin + "/api/login");
  } catch (_) {}
  if (apiOrigin) candidates.push(String(apiOrigin).replace(/\/$/, "") + "/api/login");

  await warmApi(apiOrigin);

  let lastErr = null;
  for (const url of candidates) {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body && body.session && body.session.token) {
          return { ok: true, session: body.session, via: url, attempt };
        }
        lastErr = new Error("login HTTP " + res.status + " via " + url);
        if ([502, 503, 504, 429].includes(res.status)) {
          await warmApi(apiOrigin);
          await sleep(2000 * attempt);
          continue;
        }
      } catch (err) {
        lastErr = err;
        await warmApi(apiOrigin);
      }
      await sleep(1500 * attempt);
    }
  }
  return { ok: false, error: lastErr };
}

async function seedProofAuth(page, base) {
  await page.goto(base + "/vault/", { waitUntil: "domcontentloaded", timeout: 60000 });

  let isRemote = false;
  try {
    const u = new URL(base);
    isRemote = u.protocol === "https:" || (u.hostname !== "127.0.0.1" && u.hostname !== "localhost");
  } catch (_) {}

  const email = String(process.env.PROOF_EMAIL || process.env.APP_REVIEW_EMAIL || "").trim().toLowerCase();
  const password = process.env.PROOF_PASSWORD || process.env.APP_REVIEW_PASSWORD || "";
  const apiOrigin = process.env.API_ORIGIN || "https://gatorvault-api.onrender.com";

  if (isRemote && email && password) {
    const login = await loginRemoteSession({ base, email, password, apiOrigin });
    if (login.ok) {
      await page.evaluate((session) => {
        localStorage.setItem("gv_session", JSON.stringify(session));
        sessionStorage.removeItem("gv_auth_handoff");
      }, login.session);
      console.log("[proof-auth] remote login ok via " + login.via + " (attempt " + login.attempt + ")");
      return;
    }
    console.warn("[proof-auth] remote login failed — continuing with public seeded routes:", (login.error && login.error.message) || login.error);
  }

  if (!isRemote) {
    await page.evaluate(() => {
      localStorage.setItem(
        "gv_session",
        JSON.stringify({
          token: "local-mobile-proof",
          email: "proof@gatorvaultinsider.com",
          tier: "war",
        })
      );
      sessionStorage.removeItem("gv_auth_handoff");
    });
    return;
  }

  await page.evaluate(() => {
    localStorage.removeItem("gv_session");
    sessionStorage.removeItem("gv_auth_handoff");
  });
}

module.exports = { seedProofAuth };
