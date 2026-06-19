#!/usr/bin/env node
/** Verify podcast episode pages load correct vault-chunk paths on production. */
const config = require('../lib/qa/qa-config');
const SITE = (process.env.SITE_URL || config.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');

const EPISODES = [
  '/vault/podcast/gators-breakdown/',
  '/vault/podcast/gators-online/',
  '/vault/podcast/gnfp/',
  '/vault/podcast/gator-tales/',
];

async function head(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return res.status;
}

async function main() {
  console.log('[podcast-chunk] SITE_URL:', SITE);
  let failed = 0;

  const manifest = await fetch(`${SITE}/build-manifest.json`).then((r) => r.text());
  console.log('build-manifest:', manifest.trim().slice(0, 120));

  for (const path of EPISODES) {
    const html = await fetch(`${SITE}${path}`, { redirect: 'follow' }).then((r) => r.text());
    const badRelative = /["']js\/vault-chunks\//.test(html);
    const hasAbsolute = html.includes('"/js/vault-chunks/r-vault-podcast-[id]-page-');
    const chunkMatch = html.match(/\/js\/vault-chunks\/r-vault-podcast-\[id\]-page-([a-f0-9]+)\.js/);
    const chunkHash = chunkMatch?.[1];
    const chunkUrl = chunkHash
      ? `${SITE}/js/vault-chunks/r-vault-podcast-%5Bid%5D-page-${chunkHash}.js`
      : null;
    const chunkStatus = chunkUrl ? await head(chunkUrl) : 0;
    const redirectStatus = chunkHash
      ? await head(
          `${SITE}/_next/js/vault-chunks/r-vault-podcast-%5Bid%5D-page-${chunkHash}.js`
        )
      : 0;

    if (badRelative || !hasAbsolute || chunkStatus !== 200) {
      failed++;
      console.log(
        `FAIL ${path} relative=${badRelative} absolute=${hasAbsolute} chunkHTTP=${chunkStatus} redirectHTTP=${redirectStatus}`
      );
    } else {
      console.log(
        `OK   ${path} chunk ${chunkHash} HTTP ${chunkStatus} (_next redirect ${redirectStatus})`
      );
    }
  }

  if (failed) {
    console.error(`[podcast-chunk] FAIL (${failed})`);
    process.exit(1);
  }
  console.log('[podcast-chunk] PASS');
}

main().catch((e) => {
  console.error('[podcast-chunk] fatal:', e.message);
  process.exit(1);
});
