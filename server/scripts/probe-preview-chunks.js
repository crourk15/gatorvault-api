const https = require('https');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'https://deploy-preview-65--stupendous-paprenjak-bedb92.netlify.app';
const pages = [
  'welcome/index.html',
  'insider/index.html',
  'gatornation-live/index.html',
  'recruiting-hub/index.html',
  'vault/team/index.html',
];

function head(url) {
  return new Promise((resolve) => {
    https
      .request(url, { method: 'HEAD', headers: { 'User-Agent': 'ChunkProbe/1.0' } }, (res) => {
        resolve({ url, status: res.statusCode });
      })
      .on('error', (err) => resolve({ url, status: 0, err: err.message }))
      .end();
  });
}

(async () => {
  for (const page of pages) {
    const file = path.join(__dirname, '..', page);
    if (!fs.existsSync(file)) {
      console.log(`\n=== ${page} === MISSING LOCAL FILE`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const appChunks = [...html.matchAll(/\/_next\/static\/chunks\/app\/[^"']+/g)].map((m) => m[0]);
    const vaultChunks = [...html.matchAll(/\/js\/vault-chunks\/[^"']+/g)].map((m) => m[0]);
    console.log(`\n=== ${page} ===`);
    console.log(`app chunk refs: ${appChunks.length}, vault-chunk refs: ${vaultChunks.length}`);
    for (const asset of appChunks) {
      const result = await head(base + asset);
      console.log(`  APP ${result.status} ${asset}`);
    }
    for (const asset of vaultChunks.slice(0, 3)) {
      const result = await head(base + asset);
      console.log(`  VAULT ${result.status} ${asset}`);
    }
  }
})();
