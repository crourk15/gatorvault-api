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

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

/** Mirror _next/static/chunks/app/** → js/vault-chunks/app/** (preserves nested route paths). */
function publishAppChunkTree(serverDir, chunksDir) {
  const appSrc = path.join(chunksDir, 'app');
  const appDest = path.join(serverDir, VAULT_CHUNKS_DIR, 'app');
  if (!fs.existsSync(appSrc)) return 0;
  copyRecursive(appSrc, appDest);
  mirrorAppChunkAliases(appDest);
  let count = 0;
  walkFiles(appDest, (file) => {
    if (file.endsWith('.js')) count += 1;
  });
  return count;
}

/** RSC refs omit route groups and URL-encode dynamic segments — mirror those alias paths. */
function mirrorAppChunkAliases(appDest) {
  const files = [];
  walkFiles(appDest, (file) => {
    if (file.endsWith('.js')) files.push(file);
  });
  for (const file of files) {
    const rel = path.relative(appDest, file).replace(/\\/g, '/');
    const aliases = new Set();
    const withoutGroups = rel.replace(/^\((app|marketing|home)\)\//, '');
    if (withoutGroups !== rel) aliases.add(withoutGroups);
    for (const candidate of [rel, withoutGroups]) {
      const encoded = encodeDynamicPath(candidate);
      if (encoded !== candidate) aliases.add(encoded);
    }
    for (const alias of aliases) {
      if (alias === rel) continue;
      const altDest = path.join(appDest, alias);
      if (fs.existsSync(altDest)) continue;
      fs.mkdirSync(path.dirname(altDest), { recursive: true });
      fs.copyFileSync(file, altDest);
    }
  }
}

function appChunkNestedRel(rel) {
  return rel.replace(/^\(app\)\//, '');
}

function bareStaticAppChunkPublicPath(sub, relFromApp) {
  const nested = ensureAppChunkRelJs(appChunkNestedRel(relFromApp));
  return `/${VAULT_CHUNKS_DIR}/${sub}/${nested}`;
}

function addChunkMappings(map, rel, publicPath) {
  const relVariants = [rel];
  if (rel.startsWith('(app)/')) relVariants.push(rel.slice('(app)/'.length));
  else relVariants.push(`(app)/${rel}`);

  for (const variant of relVariants) {
    map.set(`/_next/static/chunks/app/${variant}`, publicPath);
    map.set(`/_next/static/chunks/routes/${variant}`, publicPath);
    const nestedRel = ensureAppChunkRelJs(appChunkNestedRel(variant));
    const nestedAppPublic = `/${VAULT_CHUNKS_DIR}/app/${nestedRel}`;
    map.set(`static/chunks/app/${variant}`, nestedAppPublic.replace(/^\//, ''));
    map.set(`static/chunks/app/${nestedRel}`, nestedAppPublic.replace(/^\//, ''));

    const encoded = encodeDynamicPath(variant);
    if (encoded !== variant) {
      map.set(`/_next/static/chunks/app/${encoded}`, publicPath);
      map.set(`/_next/static/chunks/routes/${encoded}`, publicPath);
      const nestedEncoded = ensureAppChunkRelJs(appChunkNestedRel(encoded));
      const nestedEncodedPublic = `/${VAULT_CHUNKS_DIR}/app/${nestedEncoded}`;
      map.set(`static/chunks/app/${encoded}`, nestedEncodedPublic.replace(/^\//, ''));
      map.set(`static/chunks/app/${nestedEncoded}`, nestedEncodedPublic.replace(/^\//, ''));
    }
  }

  map.set(`/_next/static/chunks/${flatChunkName(rel)}`, publicPath);
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
  const seen = new Set();
  for (const sub of ['app', 'routes']) {
    const dir = path.join(chunksDir, sub);
    if (!fs.existsSync(dir)) continue;
    walkFiles(dir, (file) => {
      if (!file.endsWith('.js')) return;
      const rel = path.relative(dir, file).replace(/\\/g, '/');
      if (seen.has(rel)) return;
      seen.add(rel);
      collected.push({ file, rel, flat: flatChunkName(rel) });
    });
    // Root layout-*.js (and siblings) must be mapped — walkFiles covers these; readdir is a
    // fallback for platforms where nested walk ordering differs from HTML/RSC chunk refs.
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      const file = path.join(dir, name);
      if (!fs.statSync(file).isFile()) continue;
      const rel = name.replace(/\\/g, '/');
      if (seen.has(rel)) continue;
      seen.add(rel);
      collected.push({ file, rel, flat: flatChunkName(rel) });
    }
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

  const appTreeFiles = publishAppChunkTree(serverDir, chunksDir);

  if (fs.existsSync(chunksDir)) {
    for (const name of fs.readdirSync(chunksDir)) {
      if (!name.endsWith('.js')) continue;
      if (name.startsWith('main-app-') || name.startsWith('main-entry-') || name.startsWith('mentry-')) {
        const src = path.join(chunksDir, name);
        const flat = name.startsWith('mentry-') ? name : name.replace(/^main-(app|entry)-/, 'mentry-');
        const publicPath = publishVaultChunk(serverDir, src, flat);
        map.set(`/_next/static/chunks/${name}`, publicPath);
        if (flat !== name) map.set(`/_next/static/chunks/${flat}`, publicPath);
        map.set(`static/chunks/${name}`, publicPath.replace(/^\//, ''));
        if (flat !== name) map.set(`static/chunks/${flat}`, publicPath.replace(/^\//, ''));
      }
    }
    for (const name of fs.readdirSync(chunksDir)) {
      if (!name.endsWith('.js')) continue;
      if (
        name.startsWith('main-app-') ||
        name.startsWith('main-entry-') ||
        name.startsWith('mentry-') ||
        name.startsWith('r-')
      ) {
        continue;
      }
      const src = path.join(chunksDir, name);
      if (!fs.statSync(src).isFile()) continue;
      // RSC flight embeds bare static/chunks/*.js — mirror shared webpack bundles in vault-chunks.
      const publicPath = publishVaultChunk(serverDir, src, name);
      map.set(`static/chunks/${name}`, publicPath.replace(/^\//, ''));
      map.set(`/_next/static/chunks/${name}`, publicPath);
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

  return { map, appTreeFiles };
}

function applyReplacements(content, map) {
  let next = content;
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

function decodeChunkRefPath(rel) {
  try {
    return decodeURIComponent(rel);
  } catch {
    return rel;
  }
}

function listVaultChunkFilenames(serverDir) {
  const dir = path.join(serverDir, VAULT_CHUNKS_DIR);
  const names = new Set();
  if (!fs.existsSync(dir)) return names;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.js')) names.add(name);
  }
  return names;
}

function ensureAppChunkRelJs(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.endsWith('.js') ? normalized : `${normalized}.js`;
}

/** Route key without webpack content hash: vault/layout-501318… → vault/layout */
function appChunkRouteKey(relFromAppDir) {
  const normalized = String(relFromAppDir || '').replace(/\\/g, '/');
  const withoutGroups = normalized.replace(/^\((app|marketing|home)\)\//, '');
  const parts = withoutGroups.split('/');
  const file = parts[parts.length - 1];
  const m = file.match(/^(.+)-([a-f0-9]{8,})\.js$/i);
  if (!m) return withoutGroups.replace(/\.js$/, '');
  parts[parts.length - 1] = m[1];
  return parts.join('/');
}

/** Index published nested app chunks by route key → /js/vault-chunks/app/... path */
function buildNestedAppChunkIndex(serverDir) {
  const index = new Map();
  const appDir = path.join(serverDir, VAULT_CHUNKS_DIR, 'app');
  if (!fs.existsSync(appDir)) return index;

  walkFiles(appDir, (file) => {
    if (!file.endsWith('.js')) return;
    const rel = path.relative(appDir, file).replace(/\\/g, '/');
    const publicPath = `/${VAULT_CHUNKS_DIR}/app/${rel}`;
    const keys = new Set([appChunkRouteKey(rel)]);
    const noGroup = rel.replace(/^\((app|marketing|home)\)\//, '');
    if (noGroup !== rel) keys.add(appChunkRouteKey(noGroup));
    keys.add(appChunkRouteKey(encodeDynamicPath(rel)));
    keys.add(appChunkRouteKey(encodeDynamicPath(noGroup)));
    for (const key of keys) {
      if (key) index.set(key, publicPath);
    }
  });

  return index;
}

/** Map stale RSC ref (any hash) to the canonical nested chunk on disk */
function resolveNestedAppChunkRef(index, relPath) {
  if (!index || !relPath) return null;
  const decoded = decodeChunkRefPath(String(relPath).replace(/\\/g, '/').replace(/\.js$/, ''));
  const parts = decoded.split('/').filter(Boolean);
  if (!parts.length) return null;
  const file = parts[parts.length - 1];
  const m = file.match(/^(.+)-([a-f0-9]{8,})$/i);
  const stem = m ? m[1] : file;
  const keyCandidates = [
    [...parts.slice(0, -1), stem].join('/'),
    [`(app)`, ...parts.slice(0, -1), stem].join('/'),
  ];
  for (const key of keyCandidates) {
    if (index.has(key)) return index.get(key);
    const decodedKey = decodeChunkRefPath(key);
    if (index.has(decodedKey)) return index.get(decodedKey);
  }
  return null;
}

function nestedAppChunkPublicPath(index, sub, relFromApp) {
  if (sub === 'app' && index) {
    const resolved = resolveNestedAppChunkRef(index, ensureAppChunkRelJs(appChunkNestedRel(relFromApp)));
    if (resolved) return resolved;
  }
  return bareStaticAppChunkPublicPath(sub, relFromApp);
}

function vaultPublicPathForAppRel(relFromApp, vaultChunks) {
  const normalized = ensureAppChunkRelJs(relFromApp);
  const relCandidates = [
    normalized,
    decodeChunkRefPath(normalized),
    normalized.startsWith('(app)/') ? normalized.slice('(app)/'.length) : `(app)/${normalized}`,
  ];
  for (const rel of relCandidates) {
    const flat = flatChunkName(rel);
    if (vaultChunks.has(flat)) return `/${VAULT_CHUNKS_DIR}/${flat}`;
  }
  const base = path.posix.basename(normalized);
  if (base.endsWith('.js')) {
    for (const name of vaultChunks) {
      if (name === base || name.endsWith(`-${base}`) || name.endsWith(base)) {
        return `/${VAULT_CHUNKS_DIR}/${name}`;
      }
    }
  }
  return bareStaticAppChunkPublicPath('app', normalized);
}

function vaultPublicPathForMentry(name, vaultChunks) {
  const flat = name.startsWith('mentry-')
    ? name
    : name.replace(/^main-(app|entry)-/, 'mentry-');
  if (vaultChunks.has(flat)) return `/${VAULT_CHUNKS_DIR}/${flat}`;
  return null;
}

function vaultPublicPathForBareChunk(name, vaultChunks) {
  if (vaultChunks.has(name)) return `/${VAULT_CHUNKS_DIR}/${name}`;
  return null;
}

/** In __next_f flight data, numeric webpack chunks must use static/chunks/ (webpack d.p=/_next/). */
function revertNumericWebpackChunksInRscFlight(content) {
  return content.replace(
    /,\\"\/js\/vault-chunks\/(\d+-[a-f0-9]+\.js)\\"/g,
    ',\\"static/chunks/$1\\"'
  );
}

/** Remove only erroneous *double* backslashes before quotes — never strip valid JSON \\" in __next_f. */
function stripRscChunkRefEscapes(content) {
  return content
    .replace(/(static\/chunks\/[^"'\\]+?\.js)\\\\+(?=["'])/g, '$1\\')
    .replace(/(\/_next\/static\/chunks\/[^"'\\]+?\.js)\\\\+(?=["'])/g, '$1\\')
    .replace(/(\/js\/vault-chunks\/[^"'\\]+?\.js)\\\\+(?=["'])/g, '$1\\');
}

/** Regex fallback: rewrite bare static/chunks/*.js refs in RSC flight (no /_next/ prefix). */
function sweepContentUnmappedBareStaticChunkRefs(content, vaultChunks) {
  let next = content.replace(
    /static\/chunks\/(?!app\/|routes\/|main-app-|main-entry-)([^"'\\?\s]+\.js)/g,
    (match, name) => {
      const publicPath = vaultPublicPathForBareChunk(name, vaultChunks);
      return publicPath || match;
    }
  );
  // Legacy/alternate bare ref shape (single-segment webpack ids).
  next = next.replace(/\bstatic\/chunks\/([A-Za-z0-9_.-]+)\.js\b/g, (match, stem) => {
    const name = `${stem}.js`;
    const publicPath = vaultPublicPathForBareChunk(name, vaultChunks);
    return publicPath || match;
  });
  return next;
}

/** Regex fallback: rewrite bare static/chunks/app/... refs in HTML/RSC flight (no /_next/ prefix). */
function sweepContentUnmappedStaticAppChunkRefs(content, nestedIndex) {
  let next = content.replace(
    /\bstatic\/chunks\/app\/([A-Za-z0-9/_%-]+)\.js\b/g,
    (match, relPath) =>
      resolveNestedAppChunkRef(nestedIndex, relPath) || `/${VAULT_CHUNKS_DIR}/app/${relPath}.js`
  );
  // RSC flight often embeds app chunk ids without a .js suffix before the closing quote.
  next = next.replace(
    /\bstatic\/chunks\/app\/([A-Za-z0-9/_%-]+)(?=["'\\s,[\]|\\]|$)/g,
    (_, relPath) =>
      resolveNestedAppChunkRef(nestedIndex, relPath) ||
      `/${VAULT_CHUNKS_DIR}/app/${ensureAppChunkRelJs(relPath)}`
  );
  // Fix already-rewritten refs that still carry a stale webpack hash.
  next = next.replace(
    /\/js\/vault-chunks\/app\/([A-Za-z0-9/_%-]+\.js)/g,
    (match, relPath) => resolveNestedAppChunkRef(nestedIndex, relPath) || match
  );
  return next;
}

/** Regex fallback: rewrite any remaining app/routes chunk refs when vault chunk exists. */
function sweepContentUnmappedAppChunkRefs(content, vaultChunks, nestedIndex) {
  let next = stripRscChunkRefEscapes(content);
  next = sweepContentUnmappedStaticAppChunkRefs(next, nestedIndex);
  next = next.replace(/\/_next\/static\/chunks\/(app|routes)\/([^"'\\?\s]+)/g, (match, sub, rel) => {
    const publicPath = vaultPublicPathForAppRel(rel, vaultChunks);
    if (publicPath && sub !== 'app') return publicPath;
    return nestedAppChunkPublicPath(nestedIndex, sub, rel);
  });
  next = next.replace(/static\/chunks\/(app|routes)\/([^"'\\?\s]+)/g, (match, sub, rel) => {
    return nestedAppChunkPublicPath(nestedIndex, sub, rel);
  });
  next = next.replace(/\/_next\/static\/chunks\/main-(app|entry)-([^"'\\?\s]+)/g, (match, _kind, rest) => {
    const publicPath = vaultPublicPathForMentry(`main-${_kind}-${rest}`, vaultChunks);
    return publicPath || match;
  });
  next = next.replace(/static\/chunks\/main-(app|entry)-([^"'\\?\s]+)/g, (match, _kind, rest) => {
    const publicPath = vaultPublicPathForMentry(`main-${_kind}-${rest}`, vaultChunks);
    return publicPath || match;
  });
  next = next.replace(/\/_next\/static\/chunks\/([^"'\\?\s]+\.js)/g, (match, name) => {
    const publicPath = vaultPublicPathForBareChunk(name, vaultChunks);
    return publicPath || match;
  });
  next = sweepContentUnmappedBareStaticChunkRefs(next, vaultChunks);
  return next;
}

function findUnrewrittenChunkRefs(content) {
  const refs = [];
  const patterns = [
    /\/_next\/static\/chunks\/(?:app|routes)\/[^"'\\?\s]+/g,
    /\/_next\/static\/chunks\/main-(?:app|entry)-[^"'\\?\s]+/g,
    /(?:^|["'\s,[])static\/chunks\/(?:app|routes)\/[^"'\\?\s]+/g,
  ];
  for (const re of patterns) {
    for (const match of content.matchAll(re)) refs.push(match[0]);
  }
  return refs;
}

function sweepUnmappedAppChunkRefs(serverDir, nestedIndex) {
  const vaultChunks = listVaultChunkFilenames(serverDir);
  const index = nestedIndex || buildNestedAppChunkIndex(serverDir);
  let filesUpdated = 0;

  walkFiles(serverDir, (file) => {
    if (!/\.(html|txt|js|json)$/.test(file)) return;
    const raw = fs.readFileSync(file, 'utf8');
    let updated = stripRscChunkRefEscapes(raw);
    updated = sweepContentUnmappedAppChunkRefs(updated, vaultChunks, index);
    updated = normalizeAbsoluteVaultChunkRefs(updated);
    if (/\.(html|txt)$/.test(file)) {
      updated = revertNumericWebpackChunksInRscFlight(updated);
    }
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  });

  return { filesUpdated };
}

/** Final pass: replace stale nested app chunk hashes with on-disk canonical paths. */
function canonicalizeNestedAppChunkRefs(serverDir) {
  const index = buildNestedAppChunkIndex(serverDir);
  if (!index.size) return { filesUpdated: 0 };
  return sweepUnmappedAppChunkRefs(serverDir, index);
}

/** Webpack publicPath is /_next/ — RSC chunk refs must be root-absolute (/js/vault-chunks/). */
function normalizeAbsoluteVaultChunkRefs(content) {
  return content
    .split('"js/vault-chunks/')
    .join('"/js/vault-chunks/')
    .split("'js/vault-chunks/")
    .join("'/js/vault-chunks/");
}

function assertAbsoluteVaultChunkRefs(serverDir) {
  const offenders = [];
  walkFiles(serverDir, (file) => {
    const rel = path.relative(serverDir, file).replace(/\\/g, '/');
    if (!/\.(html|txt)$/.test(rel)) return;
    if (!shouldAssertChunkRefs(rel)) return;
    const raw = fs.readFileSync(file, 'utf8');
    if (/["']js\/vault-chunks\//.test(raw)) offenders.push(rel);
  });
  if (offenders.length) {
    throw new Error(
      `[rewrite-next-chunk-paths] Relative vault-chunk refs (webpack resolves under /_next/) in ` +
        `${offenders.slice(0, 8).join(', ')}${offenders.length > 8 ? ` (+${offenders.length - 8} more)` : ''}`
    );
  }
}

function rewriteNextChunkPathsForNetlify(serverDir) {
  const { map, appTreeFiles } = buildReplacementMap(serverDir);
  const nestedAppChunkIndex = buildNestedAppChunkIndex(serverDir);
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
    let updated = applyReplacements(stripRscChunkRefEscapes(raw), map);
    updated = normalizeAbsoluteVaultChunkRefs(updated);
    updated = sweepContentUnmappedAppChunkRefs(updated, listVaultChunkFilenames(serverDir), nestedAppChunkIndex);
    updated = normalizeAbsoluteVaultChunkRefs(updated);
    updated = revertNumericWebpackChunksInRscFlight(updated);
    if (updated !== raw) {
      fs.writeFileSync(file, updated);
      filesUpdated++;
    }
  });

  const sweep = sweepUnmappedAppChunkRefs(serverDir, nestedAppChunkIndex);
  filesUpdated += sweep.filesUpdated;

  assertAbsoluteVaultChunkRefs(serverDir);

  return { filesUpdated, flatChunks: map.size, vaultChunksDir: VAULT_CHUNKS_DIR, appTreeFiles, nestedAppChunkIndex };
}

/** Fail build if HTML/RSC payloads still reference App Router chunk paths Netlify CDN drops. */
function assertNoUnrewrittenAppChunkRefs(serverDir) {
  const offenders = [];
  const samples = [];
  walkFiles(serverDir, (file) => {
    const rel = path.relative(serverDir, file).replace(/\\/g, '/');
    if (!shouldAssertChunkRefs(rel)) return;
    const raw = fs.readFileSync(file, 'utf8');
    const refs = findUnrewrittenChunkRefs(raw);
    if (refs.length) {
      offenders.push(rel);
      if (samples.length < 5) samples.push(`${rel}: ${refs[0]}`);
    }
  });
  if (offenders.length) {
    throw new Error(
      `[rewrite-next-chunk-paths] Unrewritten App Router chunk refs in HTML/RSC — ` +
        `${offenders.slice(0, 8).join(', ')}${offenders.length > 8 ? ` (+${offenders.length - 8} more)` : ''}` +
        (samples.length ? ` e.g. ${samples.join('; ')}` : '')
    );
  }
}

module.exports = {
  rewriteNextChunkPathsForNetlify,
  flatChunkName,
  VAULT_CHUNKS_DIR,
  assertNoUnrewrittenAppChunkRefs,
  sweepUnmappedAppChunkRefs,
  canonicalizeNestedAppChunkRefs,
  buildNestedAppChunkIndex,
  resolveNestedAppChunkRef,
  sweepContentUnmappedStaticAppChunkRefs,
  sweepContentUnmappedBareStaticChunkRefs,
  normalizeAbsoluteVaultChunkRefs,
  revertNumericWebpackChunksInRscFlight,
  assertAbsoluteVaultChunkRefs,
};
