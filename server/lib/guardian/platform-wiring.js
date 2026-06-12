/**
 * Platform wiring verification — require paths, exports, file existence, case sensitivity.
 */
const fs = require('fs');
const path = require('path');
const manifest = require('./platform-manifest');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const REQUIRE_RE = /require\s*\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;
const DESTRUCTURE_RE = /const\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;

function normalizeRel(p) {
  return p.replace(/\\/g, '/');
}

function resolveRequire(relFromServer) {
  const rel = relFromServer.replace(/^\.\//, '');
  let candidate = path.join(SERVER_ROOT, rel);
  if (fs.existsSync(candidate) || candidate.endsWith('.js')) return candidate;
  if (fs.existsSync(candidate + '.js')) return candidate + '.js';
  return candidate.endsWith('.js') ? candidate : candidate + '.js';
}

function listDirCaseMap(dir, acc = {}) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = normalizeRel(path.relative(SERVER_ROOT, full));
    acc[rel.toLowerCase()] = rel;
    if (fs.statSync(full).isDirectory()) listDirCaseMap(full, acc);
  }
  return acc;
}

function checkCaseSensitivity(relPath) {
  const caseMap = listDirCaseMap(SERVER_ROOT);
  const normalized = normalizeRel(relPath);
  const key = normalized.toLowerCase();
  const actual = caseMap[key];
  if (!actual) return { ok: false, error: `path not found: ${normalized}` };
  if (actual !== normalized) {
    return { ok: false, error: `case mismatch: import "${normalized}" but disk has "${actual}"` };
  }
  return { ok: true };
}

function parseRequires(source) {
  const paths = new Set();
  let m;
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(source)) !== null) {
    if (m[1].startsWith('./lib/') || m[1].startsWith('./scripts/')) paths.add(m[1]);
  }
  return [...paths];
}

function parseDestructuredExports(source) {
  const out = [];
  let m;
  DESTRUCTURE_RE.lastIndex = 0;
  while ((m = DESTRUCTURE_RE.exec(source)) !== null) {
    const names = m[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
    out.push({ requirePath: m[2], exports: names });
  }
  return out;
}

function verifyCriticalFiles() {
  const errors = [];
  for (const rel of manifest.CRITICAL_FILES) {
    const full = path.join(SERVER_ROOT, rel);
    if (!fs.existsSync(full)) {
      errors.push(`Missing critical file: ${rel}`);
      continue;
    }
    const caseCheck = checkCaseSensitivity(rel);
    if (!caseCheck.ok) errors.push(caseCheck.error);
  }
  return errors;
}

function verifyRouteWiring() {
  const errors = [];
  for (const route of manifest.ROUTE_WIRING) {
    const full = resolveRequire('./' + route.file);
    if (!fs.existsSync(full)) {
      errors.push(`Route file missing: ${route.file} (${route.id})`);
      continue;
    }
    const caseCheck = checkCaseSensitivity(normalizeRel(path.relative(SERVER_ROOT, full)));
    if (!caseCheck.ok) {
      errors.push(`[${route.id}] ${caseCheck.error}`);
      continue;
    }
    let mod;
    try {
      const reqPath = path.join(SERVER_ROOT, route.file);
      delete require.cache[require.resolve(reqPath)];
      mod = require(reqPath);
    } catch (err) {
      errors.push(`[${route.id}] require(${route.file}) failed: ${err.message}`);
      continue;
    }
    if (typeof mod[route.export] !== 'function') {
      errors.push(
        `[${route.id}] ${route.file} must export ${route.export} (got ${typeof mod[route.export]})`
      );
    }
  }
  return errors;
}

function verifyServerJsWiring() {
  const errors = [];
  const serverPath = path.join(SERVER_ROOT, 'server.js');
  const src = fs.readFileSync(serverPath, 'utf8');

  for (const route of manifest.ROUTE_WIRING) {
    const requirePattern = new RegExp(
      `require\\s*\\(\\s*['"]\\.\\/${route.file.replace(/\//g, '\\/')}['"]\\s*\\)`
    );
    const callPattern = new RegExp(`${route.export}\\s*\\(`);
    const inlinePattern = new RegExp(
      `require\\s*\\(\\s*['"]\\.\\/${route.file.replace(/\//g, '\\/')}['"]\\s*\\)\\.${route.export}\\s*\\(`
    );
    if (!requirePattern.test(src) && !inlinePattern.test(src)) {
      errors.push(`server.js missing require for ${route.id} (${route.file})`);
    }
    if (!callPattern.test(src) && !inlinePattern.test(src)) {
      errors.push(`server.js missing mount call ${route.export}() for ${route.id}`);
    }
  }

  for (const rel of manifest.SIDE_EFFECT_ROUTERS) {
    const req = './' + rel.replace(/\.js$/, '').replace(/^lib\//, 'lib/');
    if (!src.includes(`require('${req}')`) && !src.includes(`require("${req}")`)) {
      const alt = req.replace('.js', '');
      if (!src.includes(`require('${alt}')`) && !src.includes(`require("${alt}")`)) {
        errors.push(`server.js missing side-effect router: ${rel}`);
      }
    }
  }

  return errors;
}

function verifyRequirePathsInFile(absPath) {
  const errors = [];
  if (!fs.existsSync(absPath)) return errors;
  const relFromRoot = normalizeRel(path.relative(SERVER_ROOT, absPath));
  const src = fs.readFileSync(absPath, 'utf8');
  for (const reqPath of parseRequires(src)) {
    const resolved = resolveRequire(reqPath);
    if (!fs.existsSync(resolved)) {
      errors.push(`${relFromRoot}: require('${reqPath}') does not resolve`);
      continue;
    }
    const relResolved = normalizeRel(path.relative(SERVER_ROOT, resolved));
    const caseCheck = checkCaseSensitivity(relResolved);
    if (!caseCheck.ok) errors.push(`${relFromRoot}: ${caseCheck.error}`);
  }
  return errors;
}

function verifyAllRouteFiles() {
  const errors = [];
  const libDir = path.join(SERVER_ROOT, 'lib');
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('-routes.js') || name === 'health.js') {
        errors.push(...verifyRequirePathsInFile(full));
      }
    }
  }
  walk(libDir);
  errors.push(...verifyRequirePathsInFile(path.join(SERVER_ROOT, 'server.js')));
  return errors;
}

function simulateBoot() {
  return verifyRouteWiring();
}

function verifyPlatformWiring({ simulate = true } = {}) {
  const errors = [
    ...verifyCriticalFiles(),
    ...verifyRouteWiring(),
    ...verifyServerJsWiring(),
    ...verifyAllRouteFiles()
  ];
  if (simulate) errors.push(...simulateBoot());
  const unique = [...new Set(errors)];
  return { ok: unique.length === 0, errors: unique, checkedAt: new Date().toISOString() };
}

module.exports = {
  SERVER_ROOT,
  verifyPlatformWiring,
  verifyCriticalFiles,
  verifyRouteWiring,
  verifyServerJsWiring,
  simulateBoot,
  checkCaseSensitivity,
  parseRequires
};
