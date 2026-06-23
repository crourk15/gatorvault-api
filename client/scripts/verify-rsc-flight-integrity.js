#!/usr/bin/env node
/** Fail build if __next_f RSC flight JSON has broken escape sequences (causes blank pages). */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');

const CORRUPT_PATTERNS = [
  { re: /\/js\/vault-chunks\/[^"'\\]+?\.js",\\"/g, label: 'broken vault-chunk close quote' },
  { re: /static\/chunks\/[^"'\\]+?\.js",\\"/g, label: 'broken static-chunk close quote' },
  { re: /,\\"\/js\/vault-chunks\/\d+-[a-f0-9]+\.js\\"/g, label: 'numeric chunk must use static/chunks in RSC flight' },
];

let failed = false;
function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full);
    else if (name.name.endsWith('.html') || name.name.endsWith('.txt')) check(full);
  }
}

function check(file) {
  const rel = path.relative(serverDir, file).replace(/\\/g, '/');
  if (!rel.startsWith('vault/') && rel !== 'index.html') return;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('__next_f')) return;
  for (const { re, label } of CORRUPT_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(html)) {
      console.error(`[verify-rsc-flight] ${rel}: ${label}`);
      failed = true;
    }
  }
}

walk(serverDir);
if (failed) process.exit(1);
console.log('[verify-rsc-flight] ok — __next_f escape sequences intact');
