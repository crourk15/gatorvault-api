const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const TRACKED_EXTS = new Set(['.js', '.ts', '.tsx']);
const SKIP_PATH_RE =
  /(?:^|\/)(?:node_modules|\.next|dist|build|coverage|\.git)(?:\/|$)/;

function encodingIssue(filePath, buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return 'UTF-16 LE BOM';
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return 'UTF-16 BE BOM';
  }
  if (buf.includes(0)) {
    return 'NUL bytes (likely UTF-16)';
  }
  return null;
}

function isSourcePath(rel) {
  const normalized = rel.replace(/\\/g, '/');
  if (SKIP_PATH_RE.test(normalized)) return false;
  if (!(normalized.startsWith('server/') || normalized.startsWith('client/'))) return false;
  return TRACKED_EXTS.has(path.extname(normalized).toLowerCase());
}

function listTrackedSourceFiles() {
  try {
    const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(isSourcePath);
  } catch {
    return null;
  }
}

function listStagedSourceFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(isSourcePath);
  } catch {
    return [];
  }
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(full, exts, out);
    } else if (exts.has(path.extname(name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function fallbackFiles() {
  const files = [];
  walk(path.join(ROOT, 'server'), TRACKED_EXTS, files);
  walk(path.join(ROOT, 'client'), TRACKED_EXTS, files);
  return files.filter((file) => !SKIP_PATH_RE.test(path.relative(ROOT, file).replace(/\\/g, '/')));
}

function scanFiles(files) {
  const errors = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    const issue = encodingIssue(file, buf);
    if (issue) {
      errors.push(`${path.relative(ROOT, file)}: ${issue}`);
    }
  }
  return { ok: errors.length === 0, errors, scanned: files.length };
}

function runEncodingCheck(opts = {}) {
  const stagedOnly = Boolean(opts.staged);
  const relPaths = stagedOnly ? listStagedSourceFiles() : listTrackedSourceFiles();
  const files = relPaths
    ? relPaths.map((rel) => path.join(ROOT, rel.replace(/\//g, path.sep)))
    : fallbackFiles();
  return scanFiles(files);
}

function runFutureCastMountCheck() {
  const errors = [];
  try {
    require('tsx/cjs');
    require('../lib/futurecast-players-routes.js');
  } catch (err) {
    errors.push(`futurecast mount: ${err.message || err}`);
  }
  return { ok: errors.length === 0, errors };
}

function runEncodingGuard(opts = {}) {
  const encoding = runEncodingCheck(opts);
  const mount = opts.mount ? runFutureCastMountCheck() : { ok: true, errors: [] };
  const errors = [...encoding.errors, ...mount.errors];
  return {
    ok: encoding.ok && mount.ok,
    errors,
    scanned: encoding.scanned,
    encoding,
    mount,
  };
}

if (require.main === module) {
  const staged = process.argv.includes('--staged');
  const mount = process.argv.includes('--mount') || process.argv.includes('--mount-only');
  const mountOnly = process.argv.includes('--mount-only');

  const result = mountOnly
    ? runFutureCastMountCheck()
    : runEncodingGuard({ staged, mount });

  if (result.ok) {
    const label = mountOnly
      ? 'futurecast mount'
      : staged
        ? 'encoding-check (staged)'
        : 'encoding-check';
    const count = result.scanned != null ? ` (${result.scanned} files)` : '';
    console.log(`PASS ${label}${count}`);
  } else {
    console.error('FAIL encoding guard');
    for (const err of result.errors.slice(0, 20)) console.error(' ', err);
    if (result.errors.length > 20) {
      console.error(' ', `... and ${result.errors.length - 20} more`);
    }
    console.error('');
    console.error('Fix: save the file as UTF-8 (not UTF-16). On Windows PowerShell:');
    console.error('  [IO.File]::WriteAllText("path/to/file.ts", (Get-Content "path/to/file.ts" -Raw), (New-Object Text.UTF8Encoding $false))');
  }
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  runEncodingCheck,
  runFutureCastMountCheck,
  runEncodingGuard,
  encodingIssue,
};
