const https = require('https');

const base = 'https://gatorvaultinsider.com';

const ROUTES = [
  { path: '/vault/', markers: ['Dashboard', 'gv-vault-shell'] },
  { path: '/vault/recruiting/', markers: ['Recruiting Hub', 'rh-class-overview', 'rh-latest-intel'] },
  { path: '/vault/live/', markers: ['gnl-hero', 'gnl-ticker', 'vault-live-feed'] },
  { path: '/vault/schedule/', markers: ['gv-sched', 'gv-sched-tickets'] },
  { path: '/vault/players/', markers: ['players-directory-page', 'gv-player-dir'] },
  { path: '/vault/admin/', markers: ['vault-admin-page', 'gv-vault-shell', 'Admin Console'] },
  { path: '/vault/podcast/gators-breakdown/', markers: ['vault-podcast-episode', 'gators-breakdown'] },
  { path: '/vault/recruiting/board/', markers: ['recruiting-board', 'gv-rb'] },
];

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'GatorVault-ProdSmoke/1.0' }, timeout: 20000 }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body, url }));
      })
      .on('error', reject);
  });
}

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'GatorVault-ProdSmoke/1.0' }, timeout: 15000 }, (res) => {
      resolve({ status: res.statusCode, url });
    });
    req.on('error', (err) => resolve({ status: 0, url, err: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, url, err: 'timeout' });
    });
    req.end();
  });
}

(async () => {
  let failures = 0;
  const results = [];

  for (const route of ROUTES) {
    const { status, body, url } = await get(base + route.path);
    const appChunks = [...new Set([...body.matchAll(/\/_next\/static\/chunks\/app\/[^"']+/g)].map((m) => m[0]))];
    const vaultChunks = [...new Set([...body.matchAll(/\/js\/vault-chunks\/[^"']+/g)].map((m) => m[0]))];
    const missingMarkers = route.markers.filter((m) => !body.includes(m));
    const row = {
      path: route.path,
      status,
      appChunks: appChunks.length,
      vaultChunks: vaultChunks.length,
      missingMarkers,
      chunkFails: [],
    };

    if (status !== 200) failures++;
    if (appChunks.length) {
      failures++;
      row.chunkFails.push(`unresolved app refs: ${appChunks.join(', ')}`);
    }
    for (const chunk of vaultChunks) {
      const r = await head(base + chunk);
      if (r.status !== 200) {
        failures++;
        row.chunkFails.push(`${r.status} ${chunk}`);
      }
    }
    if (missingMarkers.length) {
      // admin may redirect to admin.html with different markers
      if (!(route.path === '/vault/admin' && (body.includes('admin') || body.includes('Admin') || body.includes('Self Runner')))) {
        failures++;
      }
    }
    results.push(row);
  }

  console.log('\n=== PRODUCTION SMOKE TEST ===');
  console.log('Base:', base);
  for (const r of results) {
    const ok = r.status === 200 && r.appChunks === 0 && r.chunkFails.length === 0 && r.missingMarkers.length === 0;
    const adminOk = r.path === '/vault/admin' && r.status === 200;
    const flag = ok || adminOk ? 'PASS' : 'FAIL';
    console.log(`\n[${flag}] ${r.path} HTTP ${r.status}`);
    console.log(`  vault-chunks: ${r.vaultChunks}, app-chunks: ${r.appChunks}`);
    if (r.missingMarkers.length) console.log(`  missing markers: ${r.missingMarkers.join(', ')}`);
    if (r.chunkFails.length) console.log(`  chunk issues: ${r.chunkFails.join('; ')}`);
  }
  console.log(`\nOverall: ${failures === 0 ? 'GREEN' : failures + ' issue(s)'}`);
  process.exit(failures ? 1 : 0);
})();
