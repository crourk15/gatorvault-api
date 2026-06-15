#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ALLOWLIST_2027 } = require('../lib/recruiting-target-allowlist');
const { filterBlockedRecruits } = require('../lib/recruiting-blocked-players');

const boardPath = path.join(__dirname, '..', 'data', 'recruiting', '2027-target-board.json');
const patternsPath = path.join(__dirname, '..', 'data', 'recruiting', 'identity-patterns.json');

const doc = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const allowed = new Set(ALLOWLIST_2027);
const before = doc.targets.length;
doc.targets = filterBlockedRecruits(
  doc.targets.filter((t) => allowed.has(String(t.slug || '').toLowerCase()))
);
fs.writeFileSync(boardPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`2027-target-board: ${before} -> ${doc.targets.length}`);

const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
const map = patterns.entries || patterns;
if (map['trey-morrison']) {
  delete map['trey-morrison'];
  fs.writeFileSync(patternsPath, `${JSON.stringify(patterns, null, 2)}\n`);
  console.log('Removed trey-morrison from identity-patterns');
}
