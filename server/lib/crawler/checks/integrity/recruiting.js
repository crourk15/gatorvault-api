/**
 * integrity:recruiting — React Recruiting Hub tabs + data.
 */
const config = require('../../../qa/qa-config');
const { check, fetchSiteBundleText } = require('../../../qa/qa-utils');
const { loadCrawlerConfig } = require('../../load-config');

async function runRecruitingChecks() {
  const cfg = loadCrawlerConfig();
  const tabs = cfg.components?.RecruitingHub?.tabs || ['commits', 'targets', 'heat', 'scouting', 'portal'];
  const checks = [];

  checks.push(
    await check('pages:react-recruiting-hub', 'pages', 'React Recruiting Hub', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault/recruiting');
      const required = [
        'data-testid="vault-recruiting-hub"',
        'Recruiting Hub',
        'gv-hub-tabs',
        '2026 Commits',
        'Heat Check'
      ];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`Recruiting Hub markers missing: ${missing.join(', ')}`);
        err.url = `${config.SITE_URL}/vault/recruiting`;
        throw err;
      }
      if (text.includes('war-room-panel') && !text.includes('vault-recruiting-hub')) {
        const err = new Error('Monolith War Room panel without React Recruiting Hub shell');
        throw err;
      }
      return { tabs: tabs.length };
    })
  );

  checks.push(
    await check('pages:react-futurecast', 'pages', 'React FutureCast', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault/futurecast');
      const required = ['data-testid="vault-futurecast-page"', 'FutureCast'];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`FutureCast React markers missing: ${missing.join(', ')}`);
        err.url = `${config.SITE_URL}/vault/futurecast`;
        throw err;
      }
      return { ok: true };
    })
  );

  return checks;
}

module.exports = { runRecruitingChecks };
