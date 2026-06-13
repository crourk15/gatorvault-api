/**
 * Netlify CDN serves framework _next chunks but drops App Router bundles.
 * Copy route chunks to /js/vault-chunks/ and rewrite HTML/JS references.
 */
const fs = require('fs');
const path = require('path');

const VAULT_CHUNKS_DIR = 'js/vault-chunks';

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
  const chunksDir = path.join(serverDir, '_next', 'static', 'chunks');
  const map = new Map();

  for (const { file, rel, flat } of collectAppChunks(chunksDir)) {
    const publicPath = publishVaultChunk(serverDir, file, flat);
    map.set(`/_next/static/chunks/app/${rel}`, publicPath);
    map.set(`/_next/static/chunks/routes/${rel}`, publicPath);
    map.set(`/_next/static/chunks/${flat}`, publicPath);
    map.set(`static/chunks/app/${rel}`, publicPath.replace(/^\//, ''));
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

  const htmlRoots = ['join', 'vault', 'futurecast', 'player', 'players', 'portal', 'recruiting-board', 'scouting', 'alerts', 'staff'];
  for (const root of htmlRoots) {
    const target = path.join(serverDir, root);
    if (!fs.existsSync(target)) continue;
    walkFiles(target, (file) => {
      if (!/\.(html|txt)$/.test(file)) return;
      const raw = fs.readFileSync(file, 'utf8');
      const updated = applyReplacements(raw, map);
      if (updated !== raw) {
        fs.writeFileSync(file, updated);
        filesUpdated++;
      }
    });
  }

  return { filesUpdated, flatChunks: map.size, vaultChunksDir: VAULT_CHUNKS_DIR };
}

module.exports = { rewriteNextChunkPathsForNetlify, flatChunkName, VAULT_CHUNKS_DIR };
