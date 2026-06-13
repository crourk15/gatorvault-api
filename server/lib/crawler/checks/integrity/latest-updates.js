/**
 * integrity:latest-updates — React Live Feed (replaces monolith Latest Updates pane).
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../qa/qa-config');
const { check, fetchSiteBundleText } = require('../../../qa/qa-utils');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', '..');

async function runLatestUpdatesChecks() {
  const checks = [];

  checks.push(
    await check('integrity:autoposter-dedup', 'integrity', 'Live Feed dedup integrity', async () => {
      const feedPath = path.join(SERVER_ROOT, 'data', 'live', 'feed-items.json');
      let items = [];
      try {
        const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        items = Array.isArray(raw) ? raw : raw.items || raw.feed || [];
      } catch {
        return { skipped: true, reason: 'no_local_feed_file' };
      }
      const feedDedup = require('../../../live-feed-dedup');
      const validation = feedDedup.validateFeedIntegrity(items);
      if (!validation.ok) {
        const err = new Error(`${validation.issues.length} Live Feed duplication issue(s)`);
        err.details = validation.issues.slice(0, 12);
        err.repro = 'Repair data/live/feed-items.json — VaultLiveFeedPage reads via /api/live/dashboard';
        throw err;
      }
      return { feedItems: items.length };
    })
  );

  checks.push(
    await check('pages:react-live-feed', 'pages', 'React Live Feed + ticker', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault/live-feed');
      const required = [
        'data-testid="vault-live-feed"',
        'gv-live-feed',
        'gv-live-ticker',
        'Headlines',
        'Beat Writers',
        'Podcasts'
      ];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`Live Feed React markers missing: ${missing.join(', ')}`);
        err.url = `${config.SITE_URL}/vault/live-feed`;
        throw err;
      }
      if (text.includes('vpane-start') || text.includes('#live-feed-list')) {
        const err = new Error('Monolith Live Feed hooks detected');
        err.repro = 'Use VaultLiveFeedPage with gv-live-feed__list';
        throw err;
      }
      return { ok: true };
    })
  );

  return checks;
}

module.exports = { runLatestUpdatesChecks };
