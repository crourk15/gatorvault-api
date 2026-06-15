const https = require('https');

const base = process.argv[2] || 'https://deploy-preview-67--stupendous-paprenjak-bedb92.netlify.app';
const pages = [
  '/vault/',
  '/vault/live/',
  '/vault/schedule/',
  '/vault/recruiting/',
  '/vault/admin/',
  '/vault/podcast/gators-breakdown/',
  '/vault/players/',
];

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(base + path, { headers: { 'User-Agent': 'GatorVault-QA/1.0' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body, path }));
      })
      .on('error', reject);
  });
}

function head(path) {
  return new Promise((resolve) => {
    https
      .request(base + path, { method: 'HEAD', headers: { 'User-Agent': 'GatorVault-QA/1.0' } }, (res) => {
        resolve({ status: res.statusCode, path });
      })
      .on('error', (err) => resolve({ status: 0, path, err: err.message }))
      .end();
  });
}

(async () => {
  let failures = 0;
  for (const page of pages) {
    const { status, body, path } = await get(page);
    const appChunks = [...new Set([...body.matchAll(/\/_next\/static\/chunks\/app\/[^"']+/g)].map((m) => m[0]))];
    const vaultChunks = [...new Set([...body.matchAll(/\/js\/vault-chunks\/[^"']+/g)].map((m) => m[0]))];
    const hasContent = body.length > 5000;
    console.log(`\n=== ${path} HTTP ${status} len=${body.length} app=${appChunks.length} vault=${vaultChunks.length} ===`);
    if (appChunks.length) {
      failures++;
      console.log('  FAIL: unresolved app chunk refs:', appChunks.slice(0, 3).join(', '));
    }
    for (const chunk of vaultChunks.slice(0, 4)) {
      const r = await head(chunk);
      if (r.status !== 200) {
        failures++;
        console.log(`  FAIL chunk ${r.status} ${chunk}`);
      }
    }
    if (status !== 200) failures++;
    if (!hasContent && !path.includes('admin')) {
      console.log('  WARN: short HTML body');
    }
  }
  console.log(`\nQA result: ${failures === 0 ? 'PASS' : failures + ' failure(s)'}`);
  process.exit(failures ? 1 : 0);
})();
