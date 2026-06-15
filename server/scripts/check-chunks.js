const https = require('https');
function get(u) {
  return new Promise((res, rej) =>
    https
      .get(u, { headers: { 'User-Agent': 'GatorVault-ChunkCheck/1.0' } }, (r) => {
        let b = '';
        r.on('data', (c) => (b += c));
        r.on('end', () => res({ s: r.statusCode, b }));
      })
      .on('error', rej)
  );
}
(async () => {
  const base = 'https://gatorvaultinsider.com';
  const { b } = await get(`${base}/vault/team`);
  const chunks = [...new Set([...b.matchAll(/\/_next\/static\/[^"']+/g)].map((m) => m[0]))];
  console.log(`Found ${chunks.length} _next/static refs in /vault/team HTML`);
  let ok = 0;
  let bad = 0;
  for (const c of chunks) {
    const { s } = await get(`${base}${c}`);
    if (s === 200) ok++;
    else {
      bad++;
      console.log(`${s} ${c}`);
    }
  }
  console.log(`Result: ${ok} OK, ${bad} missing`);
})();
