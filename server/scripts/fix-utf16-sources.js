const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { encodingIssue } = require("./encoding-check");

const ROOT = path.join(__dirname, "..", "..");
const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
const files = out.split(/\r?\n/).filter(Boolean).filter((rel) => /\.(js|ts|tsx)$/i.test(rel));

function decode(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le", 2);
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return buf.toString("utf16be", 2);
  if (buf.includes(0)) return buf.toString("utf16le");
  return null;
}

let fixed = 0;
for (const rel of files) {
  const full = path.join(ROOT, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(full)) continue;
  const buf = fs.readFileSync(full);
  const issue = encodingIssue(full, buf);
  if (!issue) continue;
  const text = decode(buf);
  if (text == null) {
    console.error("skip (unknown encoding):", rel);
    continue;
  }
  fs.writeFileSync(full, text.replace(/^\uFEFF/, ""), "utf8");
  console.log("fixed:", rel);
  fixed += 1;
}
console.log("done,", fixed, "file(s)");