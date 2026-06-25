const fs = require('fs');
const http = require('http');
const html = fs.readFileSync(require('path').join(__dirname, '../../server/vault/team/index.html'), 'utf8');
const chunks = [...new Set([...html.matchAll(/src="(\/js\/vault-chunks\/[^"]+\.js)"/g)].map((m) => m[1]))];

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:8787${url}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, len: data.length, head: data.slice(0, 80) }));
    }).on('error', reject);
  });
}

(async () => {
  for (const c of chunks) {
    const r = await get(c);
    console.log(r.status, c, 'len', r.len, r.head.startsWith('<') ? 'HTML!' : 'js');
  }
})();
