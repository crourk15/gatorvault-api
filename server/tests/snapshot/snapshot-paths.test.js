/**
 * Snapshot path mapping + build output smoke tests.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT_ROOT = path.join(ROOT, 'page-snapshot');

function snapshotPathForApi(apiPath) {
  const HUB_YEAR = 2027;
  const PAGE_SNAPSHOT_ROOT = '/page-snapshot';
  const HUB_SNAPSHOT_ROOT = '/hub-snapshot';

  const raw = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const qIdx = raw.indexOf('?');
  const routePath = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const params = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');

  if (routePath === '/api/recruiting/hub/class-overview/all') {
    return `${HUB_SNAPSHOT_ROOT}/class-overview-all.json`;
  }
  const hubMatch = routePath.match(/^\/api\/recruiting\/hub\/([^/]+)$/);
  if (hubMatch) {
    const year = params.get('year') || String(HUB_YEAR);
    return `${HUB_SNAPSHOT_ROOT}/${year}/${hubMatch[1]}.json`;
  }

  const map = {
    '/api/live/ticker': `${PAGE_SNAPSHOT_ROOT}/home/ticker.json`,
    '/api/content/latest': `${PAGE_SNAPSHOT_ROOT}/home/content-latest.json`,
    '/api/content/published': `${PAGE_SNAPSHOT_ROOT}/articles/published.json`,
    '/api/film-room/catalog': `${PAGE_SNAPSHOT_ROOT}/film-room/catalog.json`,
    '/api/nil/dashboard': `${PAGE_SNAPSHOT_ROOT}/nil/dashboard.json`,
    '/api/betting/lines': `${PAGE_SNAPSHOT_ROOT}/game-zone/betting-lines.json`,
    '/api/roster/players': `${PAGE_SNAPSHOT_ROOT}/teams/roster-players.json`,
    '/api/team/coaching-staff': `${PAGE_SNAPSHOT_ROOT}/teams/coaching-staff.json`,
    '/api/live/dashboard': `${PAGE_SNAPSHOT_ROOT}/gatornation-live/dashboard.json`,
    '/api/futurecast/home': `${PAGE_SNAPSHOT_ROOT}/futurecast/home.json`,
    '/api/futurecast/master-board': `${PAGE_SNAPSHOT_ROOT}/futurecast/master-board.json`,
    '/api/futurecast/stock': `${PAGE_SNAPSHOT_ROOT}/futurecast/stock.json`,
    '/api/futurecast/snapshots': `${PAGE_SNAPSHOT_ROOT}/futurecast/snapshots.json`,
    '/api/futurecast/underclassmen': `${PAGE_SNAPSHOT_ROOT}/futurecast/underclassmen.json`,
  };

  if (map[routePath]) return map[routePath];

  if (routePath === '/api/recruiting/board') {
    const year = params.get('class') || params.get('classYear') || '2027';
    return `${PAGE_SNAPSHOT_ROOT}/home/recruiting-board-${year}.json`;
  }
  if (routePath === '/api/futurecast/class') {
    const year = params.get('year') || '2027';
    return `${PAGE_SNAPSHOT_ROOT}/futurecast/class-${year}.json`;
  }
  if (routePath === '/api/futurecast/high-priority') {
    const year = params.get('year') || '2027';
    return `${PAGE_SNAPSHOT_ROOT}/futurecast/high-priority-${year}.json`;
  }

  return null;
}

test('snapshotPathForApi maps hub and page endpoints', () => {
  assert.equal(snapshotPathForApi('/api/live/ticker'), '/page-snapshot/home/ticker.json');
  assert.equal(snapshotPathForApi('/api/futurecast/home'), '/page-snapshot/futurecast/home.json');
  assert.equal(
    snapshotPathForApi('/api/recruiting/board?class=2027'),
    '/page-snapshot/home/recruiting-board-2027.json'
  );
  assert.equal(
    snapshotPathForApi('/api/recruiting/hub/ticker?year=2027'),
    '/hub-snapshot/2027/ticker.json'
  );
  assert.equal(snapshotPathForApi('/api/unknown'), null);
});

test('page snapshot build outputs exist when directory present', () => {
  if (!fs.existsSync(SNAPSHOT_ROOT)) {
    return;
  }
  const required = [
    'home/ticker.json',
    'home/content-latest.json',
    'articles/published.json',
    'film-room/catalog.json',
    'nil/dashboard.json',
    'game-zone/betting-lines.json',
    'teams/roster-players.json',
    'gatornation-live/dashboard.json',
    'futurecast/home.json',
  ];
  for (const rel of required) {
    const file = path.join(SNAPSHOT_ROOT, rel);
    assert.ok(fs.existsSync(file), `missing snapshot ${rel}`);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(doc.meta?.snapshot, true, `${rel} missing meta.snapshot`);
  }
});
