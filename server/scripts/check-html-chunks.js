const fs = require('fs');
const file = process.argv[2] || 'server/vault/podcast/gators-breakdown/index.html';
const b = fs.readFileSync(file, 'utf8');
const app = [...b.matchAll(/\/_next\/static\/chunks\/app\/[^"']+/g)].map((m) => m[0]);
const vault = [...b.matchAll(/\/js\/vault-chunks\/[^"']+/g)].map((m) => m[0]);
console.log('file:', file);
console.log('app refs:', app.length ? app : 'none');
console.log('vault refs:', vault);
