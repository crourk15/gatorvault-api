/**
 * Static page / HTML marker checks (desktop + mobile fetch).
 */
const config = require('./qa-config');
const { check, fetchText, fetchSiteBundleText, moduleResult } = require('./qa-utils');

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function checkPage(page, viewport) {
  const url = `${config.SITE_URL}${page.path}`;
  const headers = viewport === 'mobile' ? { 'User-Agent': MOBILE_UA } : {};
  const { text } = await fetchText(url, { headers });
  const missing = (page.markers || []).filter((m) => !text.includes(m));
  if (missing.length) {
    const err = new Error(`Missing markers on ${page.path} (${viewport}): ${missing.join(', ')}`);
    err.url = url;
    err.details = { viewport, missing };
    err.repro = `Load ${url} on ${viewport}; verify deployed build includes required UI hooks`;
    throw err;
  }
  return { url, viewport, markers: page.markers.length };
}

async function runPageChecks() {
  const checks = [];

  for (const page of config.PUBLIC_PAGES) {
    checks.push(
      await check(`pages:${page.id}:desktop`, 'pages', `${page.path} (desktop HTML)`, () =>
        checkPage(page, 'desktop')
      )
    );
    checks.push(
      await check(`pages:${page.id}:mobile`, 'pages', `${page.path} (mobile HTML)`, () =>
        checkPage(page, 'mobile')
      )
    );
  }

  checks.push(
    await check('pages:film-room-hooks', 'pages', 'Film Room verified source hooks', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/');
      const required = [
        'gvOpenVerifiedSource',
        'gv-film-source',
        'gv-verified-source-modal',
        'gvWireFilmSources',
        'openHighlightPlayer'
      ];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`Film Room hooks missing: ${missing.join(', ')}`);
        err.url = config.SITE_URL;
        err.repro = 'Deploy latest index.html with verified source modal wiring';
        throw err;
      }
      return { hooks: required.length };
    })
  );

  checks.push(
    await check('pages:team-hooks', 'pages', 'Team tab modal hooks', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/');
      const required = ['gv-team-detail-modal', 'gv-team-mobile.js', 'gvOpenTeamDetail'];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`Team tab hooks missing: ${missing.join(', ')}`);
        err.url = config.SITE_URL;
        throw err;
      }
      return { hooks: required.length };
    })
  );

  return moduleResult('pages', checks);
}

module.exports = { runPageChecks };
