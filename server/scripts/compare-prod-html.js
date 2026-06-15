const https = require('https');

function get(url) {
  return new Promise((res) => {
    https
      .get(url, { headers: { 'User-Agent': 'Compare/1.0' } }, (r) => {
        let b = '';
        r.on('data', (c) => (b += c));
        r.on('end', () => res({ status: r.statusCode, b }));
      })
      .on('error', (e) => res({ status: 0, b: e.message }));
  });
}

(async () => {
  const fs = require('fs');
  const local = fs.readFileSync(require('path').join(__dirname, '../vault/team/index.html'), 'utf8');
  const prod = await get('https://gatorvaultinsider.com/vault/team/');
  console.log('prod status', prod.status, 'len', prod.b.length);
  const localChunks = [...local.matchAll(/\/_next\/static\/chunks\/[^"']+/g)].map((m) => m[0]);
  const prodChunks = [...prod.b.matchAll(/\/_next\/static\/chunks\/[^"']+/g)].map((m) => m[0]);
  console.log('local chunks', localChunks.length, 'prod chunks', prodChunks.length);
  for (const c of localChunks) {
    const inProd = prodChunks.includes(c);
    const r = await get('https://gatorvaultinsider.com' + c);
    console.log(r.status, inProd ? 'html' : 'MISSING-HTML', c.slice(0, 70));
  }
})();
