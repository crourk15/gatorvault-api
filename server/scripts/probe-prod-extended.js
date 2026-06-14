#!/usr/bin/env node
/** Extended production probe — stale bundles, UX/mobile CSS, bundle scan */
const base = 'https://gatorvaultinsider.com';
const stale = [
  '/_next/static/chunks/7397-22ed9012456f13e7.js',
  '/_next/static/css/f5473cd2ebaa6cd2.css',
  '/js/vault-chunks/r-vault-team-page-e97f60aeb392f5a1.js',
  '/_next/static/chunks/app/vault/team/page-c0c882d656dad2ee.js',
];
const uxCss = [
  'overflow-x: auto',
  '-webkit-overflow-scrolling',
  'z-index: 9999',
  'z-index: 1000',
  'min-height:44px',
  'touch-action:manipulation',
  'safe-area-inset',
];
const bundleExtra = [
  'gv-live-feed__row-time',
  'gv-vault-bottom-nav',
  'env(safe-area-inset',
  '-webkit-tap-highlight-color',
];

async function main() {
  console.log('=== STALE BUNDLE CHECK (expect 404) ===');
  for (const p of stale) {
    const r = await fetch(`${base}${p}`, { method: 'HEAD', redirect: 'follow' });
    console.log(`${r.status} ${p}`);
  }

  console.log('\n=== UX / MOBILE CSS TOKENS (8287170f7f4cebd4.css) ===');
  const css = await fetch(`${base}/_next/static/css/8287170f7f4cebd4.css`).then((r) => r.text());
  for (const t of uxCss) console.log(`  ${t}: ${css.includes(t)}`);

  console.log('\n=== VIEWPORT META (/vault/live-feed/index.html) ===');
  const html = await fetch(`${base}/vault/live-feed/index.html`).then((r) => r.text());
  console.log(`  viewport meta: ${html.includes('name="viewport"')}`);
  console.log(`  width=device-width: ${html.includes('width=device-width')}`);

  console.log('\n=== BUNDLE SCAN (live-feed HTML + JS + CSS) ===');
  const { fetchSiteBundleText } = require('../lib/qa/qa-utils');
  const bundle = await fetchSiteBundleText(base, '/vault/live-feed');
  for (const t of bundleExtra) console.log(`  ${t}: ${bundle.includes(t)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
