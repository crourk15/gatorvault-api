const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const files = [
  ['server/lib/admin-hub-routes.js', fs.readFileSync(path.join(root, 'server/lib/admin-hub-routes.js'), 'utf8')],
  ['server/admin-login.html', fs.readFileSync(path.join(root, 'server/admin-login.html'), 'utf8')],
  ['server/js/admin-hub-dashboard.js', fs.readFileSync(path.join(root, 'server/js/admin-hub-dashboard.js'), 'utf8')]
];

files.forEach(function (pair) {
  const rel = pair[0];
  const content = pair[1];
  const out = path.join(root, rel);
  fs.writeFileSync(out, content, 'utf8');
  const buf = fs.readFileSync(out);
  const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const firstLine = content.split(/\r?\n/)[0];
  console.log(rel, 'bytes=' + buf.length, 'bom=' + bom, 'first=' + JSON.stringify(firstLine.slice(0, 60)));
});

require(path.join(root, 'server/lib/admin-hub-routes.js'));
console.log('admin-hub-routes.js: require OK');
