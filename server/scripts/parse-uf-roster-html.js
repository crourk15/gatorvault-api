const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'data', 'roster', 'uf-roster-2026.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const linkRe = /href="(\/sports\/football\/roster\/[^"]+)"/g;
const links = new Set();
let m;
while ((m = linkRe.exec(html))) links.add(m[1]);
console.log('profile links:', links.size);
[...links].slice(0, 15).forEach((l) => console.log(l));

// Try embedded JSON payloads
const jsonRe = /"first_name":"([^"]+)","last_name":"([^"]+)"/g;
const names = [];
while ((m = jsonRe.exec(html))) names.push(m[1] + ' ' + m[2]);
console.log('json names:', names.length);
console.log(names.slice(0, 10));
