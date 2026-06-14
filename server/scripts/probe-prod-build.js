#!/usr/bin/env node
/** Quick production build probe — markers + asset HTTP status */
const pages = [
  { path: '/vault/live-feed/index.html', markers: ['gv-live-ticker', 'gv-live-feed__tabs', 'gv-live-feed__row', 'Headlines'] },
  { path: '/vault/recruiting/index.html', markers: ['2026 Commits', 'Heat Check', 'gv-hub-tabs'] },
  { path: '/vault/film-room/index.html', markers: ['UF Press Conferences', 'Highlights', 'gv-film-hub-grid'] },
  { path: '/vault/team/index.html', markers: ['Full Roster', 'Depth Chart', 'gv-team-page'] },
];

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return { status: res.status, text: res.ok ? await res.text() : '' };
}

async function main() {
  const base = 'https://gatorvaultinsider.com';
  const manifest = await fetchText(`${base}/build-manifest.json`);
  console.log('build-manifest:', manifest.text.trim().slice(0, 200));

  for (const page of pages) {
    const { status, text } = await fetchText(`${base}${page.path}`);
    console.log(`\n=== ${page.path} (${status}) ===`);
    for (const m of page.markers) console.log(`  ${m}: ${text.includes(m)}`);

    const scripts = [...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).slice(0, 8);
    for (const src of scripts) {
      const url = src.startsWith('http') ? src : `${base}${src.startsWith('/') ? '' : '/'}${src}`;
      const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      console.log(`  asset ${head.status} ${src}`);
    }

    const css = [...text.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]);
    for (const href of css) {
      const url = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;
      const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      const cssRes = head.ok ? await fetch(url).then((r) => r.text()) : '';
      const hasRow = cssRes.includes('gv-live-feed__row') || cssRes.includes('z-index: 9999');
      console.log(`  css ${head.status} ${href}${hasRow ? ' (has vault CSS tokens)' : ''}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
