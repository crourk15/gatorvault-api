#!/usr/bin/env node
/** Probe On3 transfer portal + player profile measurable sources. */
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function fetchNextData(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { status: res.status, error: 'no __NEXT_DATA__' };
  return { status: res.status, pageProps: JSON.parse(m[1]).props.pageProps };
}

function findSingleton(obj, path = '') {
  const hits = [];
  if (!obj || typeof obj !== 'object') return hits;
  const s = JSON.stringify(obj);
  if (s.includes('Singleton') && (s.includes('height') || s.includes('weight'))) {
    hits.push({ path, snippet: s.slice(0, 500) });
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => hits.push(...findSingleton(item, `${path}[${i}]`)));
  } else {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'player' && v && v.fullName && String(v.fullName).includes('Singleton')) {
        hits.push({
          path: `${path}.player`,
          height: v.height,
          weight: v.weight,
          fullName: v.fullName,
          key: v.key
        });
      }
      if (typeof v === 'object' && v) hits.push(...findSingleton(v, path ? `${path}.${k}` : k));
    }
  }
  return hits;
}

async function main() {
  const urls = [
    ['UF 2026 commits', 'https://www.on3.com/college/florida-gators/football/2026/commits/'],
    ['UF transfer portal', 'https://www.on3.com/college/florida-gators/football/transfer-portal/'],
    ['UF transfer portal in', 'https://www.on3.com/college/florida-gators/football/transfer-portal/in/'],
    ['UF roster', 'https://www.on3.com/college/florida-gators/football/roster/'],
    ['TP team page', 'https://www.on3.com/transfer-portal/college/florida-gators/football/'],
    ['Singleton db', 'https://www.on3.com/db/155719-eric-singleton-jr/'],
    ['Singleton rivals', 'https://www.on3.com/rivals/eric-singleton-jr-155719/']
  ];

  for (const [label, url] of urls) {
    console.log('\n===', label, '===');
    const data = await fetchNextData(url);
    if (data.error) {
      console.log('ERROR', data.status, data.error);
      continue;
    }
    const pp = data.pageProps;
    console.log('top keys:', Object.keys(pp).join(', '));

    for (const k of Object.keys(pp)) {
      const v = pp[k];
      if (v && typeof v === 'object' && Array.isArray(v.list)) {
        console.log(`  ${k}.list: ${v.list.length} rows`);
        const row = v.list.find((r) => {
          const name = r.player?.fullName || r.fullName || '';
          return name.includes('Singleton');
        });
        if (row) {
          const p = row.player || row;
          console.log('  Singleton in', k, '→', p.height, p.weight, p.fullName);
        }
      }
    }

    const hits = findSingleton(pp).filter((h) => h.height != null || h.fullName);
    if (hits.length) {
      console.log('Singleton measurable hits:');
      hits.slice(0, 5).forEach((h) => console.log(' ', JSON.stringify(h)));
    }

    const out = path.join(__dirname, '..', 'data', 'war-room', `on3-probe-${label.replace(/\s+/g, '-').toLowerCase()}.json`);
    fs.writeFileSync(out, JSON.stringify(pp, null, 2));
    console.log('saved', path.basename(out));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
