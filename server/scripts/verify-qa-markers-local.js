#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

async function bundleText(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const base = ROOT;
  let text = html;
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  const cssRe = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]+rel=["']stylesheet["']/gi;
  const assets = [];
  let m;
  while ((m = scriptRe.exec(html))) {
    if (m[1] && !m[1].includes('google')) assets.push(m[1]);
  }
  while ((m = cssRe.exec(html))) {
    const href = m[1] || m[2];
    if (href && !href.includes('fonts.googleapis')) assets.push(href);
  }
  for (const src of assets.slice(0, 12)) {
    const file = path.join(base, src.replace(/^\//, '').replace(/\//g, path.sep));
    try {
      text += '\n' + fs.readFileSync(file, 'utf8');
    } catch {
      /* skip */
    }
  }
  return text;
}

const pages = [
  { path: 'index.html', markers: ['landing-page', 'gv-landing', 'GatorVault'] },
  { path: 'vault/index.html', markers: ['vault-dashboard', 'gv-vault-shell'] },
  { path: 'vault/team/index.html', markers: ['vault-team', 'gv-team-page', 'Full Roster'] },
  { path: 'vault/recruiting/index.html', markers: ['vault-recruiting-hub', '2026 Commits', 'gv-hub-tabs'] },
  { path: 'vault/live-feed/index.html', markers: ['vault-live-feed', 'gv-live-feed', 'Headlines', 'gv-live-ticker'] },
  { path: 'vault/film-room/index.html', markers: ['vault-film-room', 'gv-film-room'] },
  { path: 'vault/futurecast/index.html', markers: ['vault-futurecast-page', 'FutureCast'] },
  { path: 'vault/schedule/index.html', markers: ['vault-schedule', 'gv-schedule-page', 'Schedule'] },
];

const uxChecks = [
  {
    name: 'scroll-containers',
    fn: async () => {
      const text = (await bundleText(path.join(ROOT, 'vault/recruiting/index.html')))
        + (await bundleText(path.join(ROOT, 'vault/live-feed/index.html')));
      const required = ['overflow-x:auto', 'overflow-x: auto', '-webkit-overflow-scrolling', 'gv-hub-tabs--scroll'];
      const hit = required.filter((k) => text.includes(k));
      return hit.length >= 2 ? 'OK' : `FAIL (${hit.length}/2+) ${required.filter((k) => !text.includes(k)).join(', ')}`;
    },
  },
  {
    name: 'live-feed-layout',
    fn: async () => {
      const text = await bundleText(path.join(ROOT, 'vault/live-feed/index.html'));
      const required = ['gv-live-ticker', 'gv-live-feed__tabs', 'gv-live-feed__row', 'gv-live-feed__row-time'];
      const missing = required.filter((k) => !text.includes(k));
      return missing.length ? `FAIL ${missing.join(', ')}` : 'OK';
    },
  },
  {
    name: 'mobile-safari',
    fn: async () => {
      const text = await bundleText(path.join(ROOT, 'vault/index.html'));
      const required = ['viewport', 'safe-area-inset', 'env(safe-area-inset'];
      const hit = required.filter((k) => text.includes(k));
      return hit.length >= 2 ? 'OK' : `FAIL (${hit.length}/2+)`;
    },
  },
  {
    name: 'vault-shell-theme',
    fn: async () => {
      const vaultShell = fs.readFileSync(path.join(ROOT, '..', 'client', 'lib', 'vault-shell.css'), 'utf8');
      const text = (await bundleText(path.join(ROOT, 'vault/index.html'))) + vaultShell;
      const required = ['gv-vault-shell', 'gv-page-title', 'gv-hub-tab'];
      const missing = required.filter((k) => !text.includes(k));
      return missing.length ? `FAIL ${missing.join(', ')}` : 'OK';
    },
  },
];

(async () => {
  for (const page of pages) {
    const text = await bundleText(path.join(ROOT, page.path));
    const missing = page.markers.filter((k) => !text.includes(k));
    console.log(`${page.path}: ${missing.length ? 'FAIL ' + missing.join(', ') : 'OK'}`);
  }
  for (const check of uxChecks) {
    console.log(`ux:${check.name}: ${await check.fn()}`);
  }
})();
