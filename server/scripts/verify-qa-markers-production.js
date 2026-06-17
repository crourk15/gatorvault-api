#!/usr/bin/env node
/** Verify QA markers against live production (same logic as Platform Guardian). */
const config = require('../lib/qa/qa-config');
const { fetchSiteBundleText } = require('../lib/qa/qa-utils');

const SITE = process.env.SITE_URL || config.SITE_URL;

const pages = [
  { path: '/', markers: ['data-testid="landing-page"', 'gv-landing', 'GatorVault'] },
  { path: '/vault', markers: ['vault-home', 'gv-vault-shell'] },
  { path: '/vault/team', markers: ['data-testid="vault-team"', 'gv-team-page', 'Full Roster', 'Depth Chart'] },
  { path: '/vault/recruiting', markers: ['vault-recruiting-hub', '2026 Commits', 'gv-hub-tabs', 'Heat Check'] },
  { path: '/vault/live-feed', markers: ['vault-live-feed', 'gv-live-feed', 'gv-live-ticker', 'Headlines', 'Beat Writers'] },
  { path: '/vault/film-room', markers: ['vault-film-room', 'gv-film-room'] },
  { path: '/vault/futurecast', markers: ['vault-futurecast-page', 'FutureCast'] },
];

async function main() {
  console.log('SITE_URL:', SITE);
  try {
    const manifest = await fetch(`${SITE.replace(/\/$/, '')}/build-manifest.json`).then((r) => r.text());
    console.log('build-manifest:', manifest.trim().slice(0, 120));
  } catch (e) {
    console.log('build-manifest fetch failed:', e.message);
  }

  let failed = 0;
  for (const page of pages) {
    const text = await fetchSiteBundleText(SITE, page.path);
    const missing = page.markers.filter((k) => !text.includes(k));
    if (missing.length) {
      failed++;
      console.log(`FAIL ${page.path}: ${missing.join(', ')}`);
    } else {
      console.log(`OK   ${page.path}`);
    }
  }

  const scroll =
    (await fetchSiteBundleText(SITE, '/vault/recruiting')) +
    (await fetchSiteBundleText(SITE, '/vault/live-feed'));
  const scrollReq = ['overflow-x:auto', 'overflow-x: auto', '-webkit-overflow-scrolling', 'gv-hub-tabs--scroll'];
  const scrollHit = scrollReq.filter((k) => scroll.includes(k));
  console.log(`ux:scroll-containers: ${scrollHit.length >= 2 ? 'OK' : 'FAIL'} (${scrollHit.length}/2+) missing=${scrollReq.filter((k) => !scroll.includes(k)).join(', ')}`);

  const live = await fetchSiteBundleText(SITE, '/vault/live-feed');
  const liveReq = ['gv-live-ticker', 'gv-live-feed__tabs', 'gv-live-feed__row', 'gv-live-feed__row-time'];
  const liveMissing = liveReq.filter((k) => !live.includes(k));
  console.log(`ux:live-feed-layout: ${liveMissing.length ? 'FAIL ' + liveMissing.join(', ') : 'OK'}`);

  const vault = await fetchSiteBundleText(SITE, '/vault');
  const saf = ['viewport', 'safe-area-inset', 'env(safe-area-inset'];
  const safHit = saf.filter((k) => vault.includes(k));
  console.log(`ux:mobile-safari: ${safHit.length >= 2 ? 'OK' : 'FAIL'} (${safHit.length}/2+)`);

  process.exit(failed > 0 || scrollHit.length < 2 || liveMissing.length || safHit.length < 2 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
