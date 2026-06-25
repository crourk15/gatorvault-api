const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");

const TRACKED_PREFIXES = ["server/lib/", "client/lib/", "client/public/"];
const TRACKED_EXTS = new Set([".js", ".ts", ".tsx"]);

function encodingIssue(filePath, buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return "UTF-16 LE BOM";
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return "UTF-16 BE BOM";
  }
  if (buf.includes(0)) {
    return "NUL bytes (likely UTF-16)";
  }
  return null;
}

function listTrackedSourceFiles() {
  try {
    const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((rel) => {
        const normalized = rel.replace(/\\/g, "/");
        if (!TRACKED_PREFIXES.some((p) => normalized.startsWith(p))) return false;
        return TRACKED_EXTS.has(path.extname(normalized).toLowerCase());
      });
  } catch {
    return null;
  }
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, exts, out);
    } else if (exts.has(path.extname(name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function fallbackFiles() {
  const files = [];
  walk(path.join(ROOT, "server", "lib"), new Set([".js"]), files);
  walk(path.join(ROOT, "client", "lib"), new Set([".ts", ".tsx", ".js"]), files);
  walk(path.join(ROOT, "client", "public"), new Set([".js"]), files);
  return files;
}

function runEncodingCheck() {
  const tracked = listTrackedSourceFiles();
  const files = tracked
    ? tracked.map((rel) => path.join(ROOT, rel.replace(/\//g, path.sep)))
    : fallbackFiles();
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

if (require.main === module) {
  const result = runEncodingCheck();
  if (result.ok) {
    console.log("PASS encoding-check (" + result.scanned + " tracked files)");
  } else {
    console.error("FAIL encoding-check");
    for (const err of result.errors.slice(0, 20)) console.error(" ", err);
    if (result.errors.length > 20) {
      console.error(" ", "... and " + (result.errors.length - 20) + " more");
    }
  }
  process.exit(result.ok ? 0 : 1);
}

module.exports = { runEncodingCheck, encodingIssue };