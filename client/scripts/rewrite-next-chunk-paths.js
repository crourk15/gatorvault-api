/**
 * Netlify CDN serves framework _next chunks but drops App Router bundles.
 * Copy route chunks to /js/vault-chunks/ and rewrite HTML/JS references.
 */
const fs = require('fs');
const path = require('path');

const VAULT_CHUNKS_DIR = 'js/vault-chunks';

/** HTML/RSC paths Netlify publishes from merge-into-server (exclude legacy Express trees). */
const NETLIFY_CHUNK_ASSERT_PREFIXES = ['vault/'];
const NETLIFY_CHUNK_ASSERT_FILES = new Set([
  'index.html',
  'join/index.html',
  'welcome/index.html',
  'insider/index.html',
  'gatornation-live/index.html',
  'recruiting-hub/index.html',
  'directory/index.html',
  'futurecast/index.html',
  'futurecast/player/index.html',
  'futurecast/alerts/index.html',
  'futurecast/movement/index.html',
  'futurecast/trending/index.html',
  'futurecast/staff/index.html',
  'futurecast/master-board/index.html',
  'futurecast/trending-board/index.html',
  'futurecast/movement-intel/index.html',
  'futurecast/staff-notes/index.html',
  'futurecast/player/index.html',
  'vault/futurecast/index.html',
  'vault/futurecast/player/index.html',
  'vault/recruiting/board/index.html',
  'vault/recruiting-board/index.html',
  'recruiting/index.html',
  'player/index.html',
  'portal/index.html',
  'alerts/index.html',
  'staff/index.html',
  'staff/dashboard/index.html',
  'scouting/index.html',
  'scouting/database/index.html',
  'scouting/queue/index.html',
  'scouting/reports/index.html',
  'players/index.html',
  'game-week/index.html',
  'game-zone/index.html',
  'live-scores/index.html',
  'nil/index.html',
  'articles/index.html',
  'community/index.html',
  'schedule/index.html',
  'film-room/index.html',
]);

function shouldAssertChunkRefs(rel) {
  if (!/\.(html|txt)$/.test(rel)) return false;
  if (rel.startsWith('futurecast-ui/')) return false;
  if (NETLIFY_CHUNK_ASSERT_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  return NETLIFY_CHUNK_ASSERT_FILES.has(rel);
}

function walkFiles(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, onFile);
    else onFile(full);
  }
}

function flatChunkName(relFromApp) {
  return `r-${relFromApp.replace(/\\/g, '/').replace(/\//g, '-')}`;
}

function encodeDynamicPath(rel) {
  return rel.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
}

function addChunkMappings(map, rel, publicPath) {
  map.set(`/_next/static/chunks/app/${rel}`, publicPath);
  map.set(`/_next/static/chunks/routes/${rel}`, publicPath);
  map.set(`/_next/static/chunks/${flatChunkName(rel)}`, publicPath);
  map.set(`static/chunks/app/${rel}`, publicPath.replace(/^\//, ''));

  const encoded = encodeDynamicPath(rel);
  if (encoded !== rel) {
    map.set(`/_next/static/chunks/app/${encoded}`, publicPath);
    map.set(`/_next/static/chunks/routes/${encoded}`, publicPath);
    map.set(`static/chunks/app/${encoded}`, publicPath.replace(/^\//, ''));
  }
}

function publishVaultChunk(serverDir, sourceFile, flatName) {
  const destDir = path.join(serverDir, VAULT_CHUNKS_DIR);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, flatName);
  fs.copyFileSync(sourceFile, dest);
  return `/${VAULT_CHUNKS_DIR}/${flatName}`;
}

function collectAppChunks(chunksDir) {
  const collected = [];
  for (const sub of ['app', 'routes']) {
    const dir = path.join(chunksDir, sub);
    if (!fs.existsSync(dir)) continue;
    walkFiles(dir, (file) => {
      if (!file.endsWith('.js')) return;
      const rel = path.relative(dir, file).replace(/\\/g, '/');
      collected.push({ file, rel, flat: flatChunkName(rel) });
    });
  }
  return collected;
}

function buildReplacementMap(serverDir) {
  const vaultChunksDir = path.join(serverDir, VAULT_CHUNKS_DIR);
  if (fs.existsSync(vaultChunksDir)) {
    fs.rmSync(vaultChunksDir, { recursive: true, force: true });
  }

  const chunksDir = path.join(serverDir, '_next', 'static', 'chunks');
  const map = new Map();

  for (const { file, rel, flat } of collectAppChunks(chunksDir)) {
    const publicPath = publishVaultChunk(serverDir, file, flat);
    addChunkMappings(map, rel, publicPath);
  }

  if (fs.existsSync(chunksDir)) {
    for (const name of fs.readdirSync(chunksDir)) {
      if (!name.endsWith('.js')) continue;
      if (name.startsWith('main-app-') || name.startsWith('main-entry-') || name.startsWith('mentry-')) {
        const src = path.join(chunksDir, name);
        const flat = name.startsWith('mentry-') ? name : name.replace(/^main-(app|entry)-/, 'mentry-');
        const publicPath = publishVaultChunk(serverDir, src, flat);
        map.set(`/_next/static/chunks/${name}`, publicPath);
        if (flat !== name) map.set(`/_next/static/chunks/${flat}`, publicPath);
      }
    }
  }

  for (const sub of ['app', 'routes']) {
    const dir = path.join(chunksDir, sub);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }

  for (const name of fs.readdirSync(chunksDir)) {
    if (name.startsWith('r-') && name.endsWith('.js')) {
      fs.unlinkSync(path.join(chunksDir, name));
    }
    if (name.startsWith('mentry-') && name.endsWith('.js')) {
      fs.unlinkSync(path.join(chunksDir, name));
    }
  }

  return map;
}

function applyReplacements(content, map) {
  let next = content;
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

function rewriteNextChunkPathsForNetlify(serverDir) {
  const map = buildReplacementMap(serverDir);
  let filesUpdated = 0;

  walkFiles(path.join(serverDir, '_next'), (file) => {
    if (!/\.(js|json|css|map|html|txt)$/.test(file)) return;
    const raw = fs.readFileSync(file, 'utf8');
    const updated = applyReplacements(raw, map);
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  });

  walkFiles(path.join(serverDir, VAULT_CHUNKS_DIR), (file) => {
    if (!file.endsWith('.js')) return;
    const raw = fs.readFileSync(file, 'utf8');
    const updated = applyReplacements(raw, map);
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  });

  for (const rel of ['index.html', 'join/index.html']) {
    const file = path.join(serverDir, rel);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const updated = applyReplacements(raw, map);
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  }

  walkFiles(serverDir, (file) => {
    if (!/\.(html|txt)$/.test(file)) return;
    const raw = fs.readFileSync(file, 'utf8');
    const updated = applyReplacements(raw, map);
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  });

  return { filesUpdated, flatChunks: map.size, vaultChunksDir: VAULT_CHUNKS_DIR };
}

/** Fail build if HTML/RSC payloads still reference App Router chunk paths Netlify CDN drops. */
function assertNoUnrewrittenAppChunkRefs(serverDir) {
  const offenders = [];
  const badPatterns = [
    /\/_next\/static\/chunks\/(?:app|routes)\//,
    /\/_next\/static\/chunks\/main-(?:app|entry)-/,
    /(?:^|["'\s])static\/chunks\/(?:app|routes)\//,
  ];
  walkFiles(serverDir, (file) => {
    const rel = path.relative(serverDir, file).replace(/\\/g, '/');
    if (!shouldAssertChunkRefs(rel)) return;
    const raw = fs.readFileSync(file, 'utf8');
    if (badPatterns.some((re) => re.test(raw))) offenders.push(rel);
  });
  if (offenders.length) {
    throw new Error(
      `[rewrite-next-chunk-paths] Unrewritten App Router chunk refs in HTML/RSC — ` +
        `${offenders.slice(0, 8).join(', ')}${offenders.length > 8 ? ` (+${offenders.length - 8} more)` : ''}`
    );
  }
}

module.exports = { rewriteNextChunkPathsForNetlify, flatChunkName, VAULT_CHUNKS_DIR, assertNoUnrewrittenAppChunkRefs };
