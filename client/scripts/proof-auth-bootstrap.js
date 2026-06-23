/** Seed a war-tier session so vault auth gate allows recruiting/futurecast/film-room in proof runs. */
async function seedProofAuth(page, base) {
  await page.goto(`${base}/vault/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
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
}

module.exports = { seedProofAuth };
