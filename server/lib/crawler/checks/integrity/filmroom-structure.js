/**
 * integrity:filmroom-structure — React Film Room hub + categories.
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../qa/qa-config');
const { check, fetchSiteBundleText } = require('../../../qa/qa-utils');
const { loadCrawlerConfig } = require('../../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', '..');

function readFilmRoomSource() {
  const paths = [
    'vault/film-room/index.html',
    path.join('..', 'client', 'components', 'vault', 'VaultFilmRoomPage.tsx'),
    path.join('..', 'client', 'lib', 'film-room-api.ts')
  ];
  for (const rel of paths) {
    try {
      const p = rel.startsWith('..') ? path.join(SERVER_ROOT, rel) : path.join(SERVER_ROOT, rel);
      return fs.readFileSync(p, 'utf8');
    } catch {
      /* try next */
    }
  }
  return '';
}

async function runFilmRoomStructureChecks() {
  const cfg = loadCrawlerConfig();
  const categories = cfg.components?.FilmRoom?.categories || [];
  const checks = [];

  checks.push(
    await check('integrity:film-room-catalog', 'integrity', 'Film Room React structure', async () => {
      const src = readFilmRoomSource();
      if (!src) {
        const err = new Error('Film Room React source/export not found');
        err.repro = 'Build VaultFilmRoomPage and merge vault/film-room/index.html';
        throw err;
      }
      const missing = categories.filter((c) => !src.includes(c));
      if (missing.length) {
        const err = new Error(`Film Room categories missing: ${missing.join(', ')}`);
        err.details = { missing };
        err.repro = 'Verify FILM_HUB_ORDER in client/lib/film-room-api.ts';
        throw err;
      }
      if (src.includes('film-room-hub-landing') || src.includes('gvOpenFilmRoomHub')) {
        const err = new Error('Retired monolith Film Room hooks detected');
        err.repro = 'Remove monolith hooks — use VaultFilmRoomPage React hub grid';
        throw err;
      }
      return { categories: categories.length };
    })
  );

  checks.push(
    await check('pages:react-film-room', 'pages', 'React Film Room production markers', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault/film-room');
      const required = [
        'data-testid="vault-film-room"',
        'gv-film-hub-grid',
        'Offensive Scheme',
        'UF Press Conferences',
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
