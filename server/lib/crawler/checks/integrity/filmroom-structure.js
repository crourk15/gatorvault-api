/**
 * integrity:filmroom-structure — React Film Room hub + categories.
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../qa/qa-config');
const { check, fetchJson, fetchSiteBundleText } = require('../../../qa/qa-utils');
const { loadCrawlerConfig } = require('../../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', '..');

function readLocalSource(relPaths) {
  for (const rel of relPaths) {
    try {
      const p = rel.startsWith('..') ? path.join(SERVER_ROOT, rel) : path.join(SERVER_ROOT, rel);
      return fs.readFileSync(p, 'utf8');
    } catch {
      /* try next */
    }
  }
  return '';
}

async function resolveFilmRoomCategories(required) {
  try {
    const { body } = await fetchJson(`${config.API_URL}/api/film-room/catalog`, {
      timeout: config.FETCH_TIMEOUT_MS,
      retries: 1
    });
    const fromApi = []
      .concat(body?.categories || [])
      .concat(body?.hubs || [])
      .concat(Object.keys(body?.byCategory || {}));
    const apiMissing = required.filter((c) => !fromApi.some((v) => String(v).includes(c)));
    if (!apiMissing.length) {
      return { source: 'api', categories: fromApi.length };
    }
  } catch {
    /* fall through */
  }

  const src = readLocalSource([
    path.join('..', 'client', 'lib', 'film-room-api.ts'),
    path.join('..', 'client', 'components', 'vault', 'VaultFilmRoomPage.tsx')
  ]);
  if (src) {
    const missing = required.filter((c) => !src.includes(c));
    if (!missing.length) return { source: 'client-source', categories: required.length };
  }

  try {
    const filmRoom = require('../../../film-room-feed');
    const hubs = filmRoom.FILM_HUBS || filmRoom.FILM_ROOM_CATEGORIES || [];
    const missing = required.filter((c) => !hubs.includes(c));
    if (!missing.length) return { source: 'film-room-feed', categories: hubs.length };
  } catch {
    /* fall through */
  }

  try {
    const text = await fetchSiteBundleText(config.SITE_URL, '/vault/film-room', {
      htmlOnly: false,
      maxAssets: 8
    });
    const missing = required.filter((c) => !text.includes(c));
    if (!missing.length) return { source: 'site-bundle', categories: required.length };
    const err = new Error(`Film Room categories missing on site: ${missing.join(', ')}`);
    err.details = { missing };
    err.repro = 'Verify FILM_HUB_ORDER in client/lib/film-room-api.ts';
    throw err;
  } catch (err) {
    if (err.details) throw err;
    const err2 = new Error('Film Room catalog source unavailable');
    err2.repro = 'Verify /api/film-room/catalog and FILM_HUB_ORDER in client/lib/film-room-api.ts';
    throw err2;
  }
}

async function runFilmRoomStructureChecks() {
  const cfg = loadCrawlerConfig();
  const categories = cfg.components?.FilmRoom?.categories || [];
  const checks = [];

  checks.push(
    await check('integrity:film-room-catalog', 'integrity', 'Film Room React structure', async () => {
      const resolved = await resolveFilmRoomCategories(categories);
      const csrHtml = readLocalSource(['vault/film-room/index.html']);
      if (csrHtml && (csrHtml.includes('film-room-hub-landing') || csrHtml.includes('gvOpenFilmRoomHub'))) {
        const err = new Error('Retired monolith Film Room hooks detected');
        err.repro = 'Remove monolith hooks — use VaultFilmRoomPage React hub grid';
        throw err;
      }
      return { categories: categories.length, source: resolved.source };
    })
  );

  checks.push(
    await check('pages:react-film-room', 'pages', 'React Film Room production markers', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault/film-room', { htmlOnly: false, maxAssets: 8 });
      const required = [
        'data-testid="vault-film-room"',
        'Film Room',
        'Scheme School',
        'Film Breakdown',
        'Press Conferences',
        'Highlights'
      ];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`React Film Room markers missing: ${missing.join(', ')}`);
        err.url = `${config.SITE_URL}/vault/film-room`;
        throw err;
      }
      return { ok: true };
    })
  );

  return checks;
}

module.exports = { runFilmRoomStructureChecks };
