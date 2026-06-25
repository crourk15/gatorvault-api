const fs = require('fs');
const h = fs.readFileSync('server/vault/team/index.html', 'utf8');
const idx = h.indexOf('1e:I[44426');
console.log(h.slice(idx, idx + 500));
const i2 = h.indexOf('["210"');
const i3 = h.indexOf('[\\"210\\"');
console.log('i2', i2, 'i3', i3);
if (i3 >= 0) console.log(JSON.stringify(h.slice(i3, i3 + 100)));
