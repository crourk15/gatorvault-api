const https = require('https');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../vault/team/index.html'), 'utf8');
const assets = [...html.matchAll(/\/_next\/static\/[^"']+/g)].map((m) => m[0]);

function head(url) {
  return new Promise((res) => {
    https
      .request(url, { method: 'HEAD', headers: { 'User-Agent': 'ChunkProbe/1.0' } }, (r) => {
        res({ url, status: r.statusCode });
      })
      .on('error', (e) => res({ url, status: 0, err: e.message }))
      .end();
  });
}

(async () => {
  const base = 'https://gatorvaultinsider.com';
  console.log('Local HTML assets:', assets.length);
  for (const a of assets.slice(0, 12)) {
    const r = await head(base + a);
    console.log(r.status, a);
  }
})();
