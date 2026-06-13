/**
 * Netlify CDN omits nested chunks/app/* and main-app-*.js from deploy.
 * Flatten route chunks to chunks/ root with r- prefix; rename main-app -> mentry-.
 */
const fs = require('fs');
const path = require('path');

function walkFiles(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, onFile);
    else onFile(full);
  }
}

function flatChunkName(relFromApp) {
  const norm = relFromApp.replace(/\\/g, '/');
  return `r-${norm.replace(/\//g, '-')}`;
}

function buildReplacementMap(serverDir) {
  const chunksDir = path.join(serverDir, '_next', 'static', 'chunks');
  const appDir = path.join(chunksDir, 'app');
  const map = new Map();

  if (fs.existsSync(appDir)) {
    walkFiles(appDir, (file) => {
      if (!file.endsWith('.js')) return;
      const rel = path.relative(appDir, file).replace(/\\/g, '/');
      const flat = flatChunkName(rel);
      const dest = path.join(chunksDir, flat);
      map.set(`/_next/static/chunks/app/${rel}`, `/_next/static/chunks/${flat}`);
      map.set(`/static/chunks/app/${rel}`, `/static/chunks/${flat}`);
      fs.copyFileSync(file, dest);
    });
    fs.rmSync(appDir, { recursive: true, force: true });
  }

  const routesDir = path.join(chunksDir, 'routes');
  if (fs.existsSync(routesDir)) {
    walkFiles(routesDir, (file) => {
      if (!file.endsWith('.js')) return;
      const rel = path.relative(routesDir, file).replace(/\\/g, '/');
      const flat = flatChunkName(rel);
      const dest = path.join(chunksDir, flat);
      map.set(`/_next/static/chunks/routes/${rel}`, `/_next/static/chunks/${flat}`);
      map.set(`/static/chunks/routes/${rel}`, `/static/chunks/${flat}`);
      if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
    });
    fs.rmSync(routesDir, { recursive: true, force: true });
  }

  if (fs.existsSync(chunksDir)) {
    for (const name of fs.readdirSync(chunksDir)) {
      if (name.startsWith('main-app-') && name.endsWith('.js')) {
        const next = name.replace('main-app-', 'mentry-');
        const from = path.join(chunksDir, name);
        const to = path.join(chunksDir, next);
        fs.renameSync(from, to);
        map.set(`/_next/static/chunks/${name}`, `/_next/static/chunks/${next}`);
      }
      if (name.startsWith('main-entry-') && name.endsWith('.js')) {
        const next = name.replace('main-entry-', 'mentry-');
        const from = path.join(chunksDir, name);
        const to = path.join(chunksDir, next);
        fs.renameSync(from, to);
        map.set(`/_next/static/chunks/${name}`, `/_next/static/chunks/${next}`);
      }
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

  return { filesUpdated, flatChunks: map.size };
}

module.exports = { rewriteNextChunkPathsForNetlify, flatChunkName, buildReplacementMap };
