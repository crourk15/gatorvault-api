/**
 * Build static page JSON snapshots from local server data (no Render at deploy time).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'page-snapshot');

function meta(endpoint, extra = {}) {
  return {
    generatedAt: new Date().toISOString(),
    snapshot: true,
    endpoint,
    source: 'build-page-snapshots',
    ...extra,
  };
}

function wrap(endpoint, value, extra = {}) {
  return { ok: true, status: 'ready', meta: meta(endpoint, extra), ...value };
}

function writeJson(relPath, payload) {
  const file = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
}

async function buildHomeSnapshotsAsync() {
  const { buildTickerPayload, buildContentLatestPayload } = require('../lib/vault-dashboard-routes');
  const store = require('../lib/recruiting-store');
  const { enrichBoard } = require('../lib/recruiting-board-enrich');

  writeJson('home/ticker.json', wrap('live/ticker', buildTickerPayload()));
  writeJson('home/content-latest.json', wrap('content/latest', buildContentLatestPayload()));

  for (const year of [2027]) {
    try {
      const board = await store.getBoard(year);
      const enriched = enrichBoard(board, false);
      writeJson(`home/recruiting-board-${year}.json`, wrap(`recruiting/board?class=${year}`, enriched, { year }));
    } catch (err) {
      console.warn('[page-snapshot] recruiting board', year, err.message);
      writeJson(
        `home/recruiting-board-${year}.json`,
        wrap(
          `recruiting/board?class=${year}`,
          { empty: true, classYear: year, players: [], commits: [], targets: [] },
          { year, degraded: true }
        )
      );
    }
  }
}

function buildArticlesSnapshot() {
  const contentStore = require('../lib/content-store');
  const feed = contentStore.getPublishedFeed();
  writeJson('articles/published.json', wrap('content/published', feed));
}

function buildFilmRoomSnapshot() {
  const filmRoom = require('../lib/film-room-feed');
  const catalog = filmRoom.buildFilmRoomCatalog();
  const items = (catalog.items || []).map((item) => ({
    ...item,
    minPaymentTier: 'film',
    locked: true,
  }));
  writeJson('film-room/catalog.json', wrap('film-room/catalog', { ...catalog, items }));
}

function buildNilSnapshot() {
  const nilStore = require('../lib/nil-store');
  const dashboard = nilStore.buildDashboard({ conference: 'SEC', programId: nilStore.UF_ID });
  writeJson('nil/dashboard.json', wrap('nil/dashboard', { dashboard }));
}

async function buildBettingSnapshot() {
  const betting = require('../lib/betting-lines');
  const lines = await betting.getBettingLines();
  writeJson('game-zone/betting-lines.json', wrap('betting/lines', lines));
}

function buildTeamsSnapshots() {
  const rosterStore = require('../lib/roster-store');
  const staffPath = path.join(ROOT, 'data', 'coaching-staff.json');
  const players = rosterStore.getAllRosterPlayers().map((p) => ({
    ...p,
    lifecycle: 'ROSTER',
  }));
  writeJson(
    'teams/roster-players.json',
    wrap('roster/players', {
      lifecycle: 'ROSTER',
      count: players.length,
      empty: players.length === 0,
      players,
    })
  );

  let staff = { version: 1, coaches: [], analysts: [], supportStaff: [] };
  try {
    staff = JSON.parse(fs.readFileSync(staffPath, 'utf8'));
  } catch {
    /* fallback empty */
  }
  writeJson('teams/coaching-staff.json', wrap('team/coaching-staff', staff));
}

function buildGnlSnapshot() {
  const { getDashboard } = require('../lib/live-aggregator');
  const dash = getDashboard({ feedLimit: 40 });
  writeJson(
    'gatornation-live/dashboard.json',
    wrap('live/dashboard', {
      feed: dash.feed ?? [],
      beat: dash.beat ?? { posts: [] },
      podcasts: dash.podcasts ?? { shows: [], fetchedAt: null, errors: [] },
      updatedAt: dash.updatedAt,
      refreshedAt: new Date().toISOString(),
    })
  );
}

async function buildFuturecastSnapshots() {
  require('tsx/cjs');

  async function invokeHandler(handler, query = {}) {
    return new Promise((resolve, reject) => {
      const req = { query, method: 'GET', path: '/' };
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader() {
          return this;
        },
        json(data) {
          resolve(data);
          return this;
        },
      };
      Promise.resolve(handler(req, res)).catch(reject);
    });
  }

  const fcBuilders = require('./futurecast-snapshot-builders');
  const payloads = await fcBuilders.buildAllFuturecastSnapshotPayloads();

  let built = 0;
  let degraded = 0;

  for (const [file, data] of Object.entries(payloads)) {
    if (data == null) continue;
    const endpoint = file.replace(/^futurecast\//, 'futurecast/').replace(/\.json$/, '');
    try {
      if (typeof data.error === 'string') {
        throw new Error(data.error);
      }
      writeJson(file, wrap(endpoint, data));
      built += 1;
    } catch (err) {
      degraded += 1;
      console.warn('[page-snapshot] futurecast', file, err.message);
    }
  }

  const handlerSpecs = [
    {
      file: 'futurecast/staff-notes-2027.json',
      endpoint: 'futurecast/staff-notes',
      handler: () => require('../api/futurecast/staff-notes').handleGetFutureCastStaffNotes,
      query: { year: '2027' },
    },
    {
      file: 'futurecast/underclassmen.json',
      endpoint: 'futurecast/underclassmen',
      handler: () => require('../api/futurecast/underclassmen').handleGetFutureCastUnderclassmen,
      query: { years: '2028,2029,2030' },
    },
  ];

  for (const spec of handlerSpecs) {
    try {
      const handler = spec.handler();
      const data = await invokeHandler(handler, spec.query);
      if (typeof data?.error === 'string') throw new Error(data.error);
      writeJson(spec.file, wrap(spec.endpoint, data, spec.query));
      built += 1;
    } catch (err) {
      degraded += 1;
      console.warn('[page-snapshot] futurecast', spec.endpoint, err.message);
    }
  }

  return { built, degraded };
}

async function main() {
  process.chdir(ROOT);

  if (fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT, { recursive: true });

  await buildHomeSnapshotsAsync();
  buildArticlesSnapshot();
  buildFilmRoomSnapshot();
  buildNilSnapshot();
  buildTeamsSnapshots();
  buildGnlSnapshot();
  await buildBettingSnapshot();

  const fc = await buildFuturecastSnapshots();

  const count = fs
    .readdirSync(OUT, { recursive: true })
    .filter((f) => String(f).endsWith('.json')).length;
  console.log('[build-page-snapshots] wrote', count, 'files to', OUT, `(futurecast degraded: ${fc.degraded})`);
}

module.exports = { main, OUT, meta, wrap, snapshotPathForApi: null };

if (require.main === module) {
  main().catch((err) => {
    console.error('[build-page-snapshots] failed:', err.message);
    process.exit(1);
  });
}
