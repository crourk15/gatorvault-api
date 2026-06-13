/**
 * Pages checks — React landing + vault routes.
 */
const config = require('../../../qa/qa-config');
const { check, moduleResult } = require('../../../qa/qa-utils');
const { runRecruitingChecks } = require('../integrity/recruiting');
const { runFilmRoomStructureChecks } = require('../integrity/filmroom-structure');
const { runTeamStructureChecks } = require('../integrity/team-structure');
const { runLatestUpdatesChecks } = require('../integrity/latest-updates');

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function checkPage(page, viewport) {
  const base = config.SITE_URL.replace(/\/$/, '');
  const url = `${base}${page.path}`;
  const headers = viewport === 'mobile' ? { 'User-Agent': MOBILE_UA } : {};
  const { text: html } = await require('../../../qa/qa-utils').fetchText(url, { headers });
  const scripts = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] && !m[1].includes('google') && !m[1].includes('cdn.jsdelivr')) scripts.push(m[1]);
  }
  let text = html;
  for (const src of scripts.slice(0, 8)) {
    const scriptUrl = src.startsWith('http') ? src : `${base}${src.startsWith('/') ? '' : '/'}${src}`;
    try {
      const { text: js } = await require('../../../qa/qa-utils').fetchText(scriptUrl, { headers });
      text += '\n' + js;
    } catch {
      /* skip */
    }
  }
  const missing = (page.markers || []).filter((marker) => !text.includes(marker));
  if (missing.length) {
    const err = new Error(`Missing React markers on ${page.path} (${viewport}): ${missing.join(', ')}`);
    err.url = url;
    err.details = { viewport, missing };
    err.repro = `Load ${url} — verify React export includes required components`;
    throw err;
  }
  if (text.includes('vpane-start') || text.includes('gvOpenTeamDetail')) {
    const err = new Error(`Monolith hooks detected on ${page.path}`);
    err.repro = 'Deploy React export — monolith vpane overlay retired';
    throw err;
  }
  return { url, viewport, markers: page.markers.length };
}

async function runHomeChecks() {
  const checks = [];
  for (const page of config.PUBLIC_PAGES) {
    checks.push(
      await check(`pages:${page.id}:desktop`, 'pages', `${page.path} React landing (desktop)`, () =>
        checkPage(page, 'desktop')
      )
    );
    checks.push(
      await check(`pages:${page.id}:mobile`, 'pages', `${page.path} React landing (mobile)`, () =>
        checkPage(page, 'mobile')
      )
    );
  }
  return checks;
}

async function runVaultPageChecks() {
  const checks = [];
  for (const page of config.REACT_VAULT_PAGES || []) {
    checks.push(
      await check(`pages:${page.id}:desktop`, 'pages', `${page.path} (desktop)`, () => checkPage(page, 'desktop'))
    );
    checks.push(
      await check(`pages:${page.id}:mobile`, 'pages', `${page.path} (mobile)`, () => checkPage(page, 'mobile'))
    );
  }
  return checks;
}

/** Replaces retired pages:team-hooks and pages:film-room-hooks */
async function runReactHookChecks() {
  const team = await runTeamStructureChecks();
  const film = await runFilmRoomStructureChecks();
  const recruiting = await runRecruitingChecks();
  const live = await runLatestUpdatesChecks();
  return [...team, ...film, ...recruiting, ...live].filter(
    (c) => c.id?.startsWith('pages:react-')
  );
}

async function runPageChecks() {
  const checks = [
    ...(await runHomeChecks()),
    ...(await runVaultPageChecks()),
    ...(await runReactHookChecks())
  ];
  return moduleResult('pages', checks);
}

module.exports = { runPageChecks, runHomeChecks, runVaultPageChecks, checkPage };
