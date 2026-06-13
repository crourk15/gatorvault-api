/**
 * Netlify blocks /_next/static/chunks/app/* and main-app-*.js from CDN deploy.
 * Rewrite to routes/ + main-entry- after export merge.
 */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  ['/_next/static/chunks/app/', '/_next/static/chunks/routes/'],
  ['/_next/static/chunks/main-app-', '/_next/static/chunks/main-entry-'],
  ['/static/chunks/app/', '/static/chunks/routes/'],
  ['/static/chunks/main-app-', '/static/chunks/main-entry-'],
];

function walkFiles(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, onFile);
    else onFile(full);
  }
}

function applyTextReplacements(content) {
  let next = content;
  for (const [from, to] of REPLACEMENTS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

function rewriteNextChunkPathsForNetlify(serverDir) {
  const chunksDir = path.join(serverDir, '_next', 'static', 'chunks');
  const appDir = path.join(chunksDir, 'app');
  const routesDir = path.join(chunksDir, 'routes');

  if (fs.existsSync(appDir)) {
    if (fs.existsSync(routesDir)) fs.rmSync(routesDir, { recursive: true, force: true });
    fs.renameSync(appDir, routesDir);
  }

  if (fs.existsSync(chunksDir)) {
    for (const name of fs.readdirSync(chunksDir)) {
      if (name.startsWith('main-app-') && name.endsWith('.js')) {
        fs.renameSync(path.join(chunksDir, name), path.join(chunksDir, name.replace('main-app-', 'main-entry-')));
      }
    }
  }

  let filesUpdated = 0;
  walkFiles(path.join(serverDir, '_next'), (file) => {
    if (!/\.(js|json|css|map|html|txt)$/.test(file)) return;
    const raw = fs.readFileSync(file, 'utf8');
    const updated = applyTextReplacements(raw);
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  });

  for (const rel of ['index.html', 'join/index.html']) {
    const file = path.join(serverDir, rel);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const updated = applyTextReplacements(raw);
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
      const updated = applyTextReplacements(raw);
      if (updated !== raw) {
        fs.writeFileSync(file, updated);
        filesUpdated++;
      }
    });
  }

  return { filesUpdated, routesDir: fs.existsSync(routesDir) };
}

module.exports = { rewriteNextChunkPathsForNetlify, applyTextReplacements, REPLACEMENTS };
