#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'app-store', 'CONNECT_SESSION.md');
const STEPS = [
  { title: 'Run npm run prep:app-store', manual: 'Fix any FAIL before opening Connect.' },
  { title: 'Open App Store Connect', url: 'https://appstoreconnect.apple.com', manual: 'GatorVault Insider -> Version 1.0' },
  { title: 'Paste metadata', manual: 'docs/app-store-screenshots/APP_STORE_CONNECT_PASTE.txt' },
  { title: 'Upload iPhone screenshots', manual: '1284x2778 PNGs 01-06 in docs/app-store-screenshots/' },
  { title: 'Upload iPad screenshots', manual: '2064x2752 PNGs in docs/app-store-screenshots/ipad-13/' },
  { title: 'Age Ratings', manual: 'docs/APP_STORE_CONNECT_REMAINING.md Step 1' },
  { title: 'App Privacy', manual: 'docs/APP_STORE_CONNECT_REMAINING.md Step 2' },
  { title: 'Review info + demo password', manual: 'Connect only — never commit password' },
];
const prep = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'app-store-prep.js')], { cwd: ROOT, encoding: 'utf8', env: process.env });
const lines = ['# Connect Session', '', new Date().toISOString(), prep.status === 0 ? 'prep: PASS' : 'prep: FIX FAILURES', ''];
STEPS.forEach((s, i) => { lines.push('## ' + (i + 1) + '. ' + s.title); if (s.url) lines.push(s.url); lines.push(s.manual, '', '- [ ] Done', ''); });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(JSON.stringify({ prepOk: prep.status === 0, sessionFile: OUT }, null, 2));
process.exit(prep.status === 0 ? 0 : 1);
