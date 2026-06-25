const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../server/vault/team/index.html'), 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
console.log('inline scripts', inline.length);
inline.forEach((m, i) => {
  const code = m[1].trim();
  if (!code || code.startsWith('self.__next_f')) return;
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
    console.log(`script ${i}: OK (${code.slice(0, 40)}...)`);
  } catch (e) {
    console.log(`script ${i}: FAIL`, e.message);
    console.log(code.slice(0, 200));
  }
});
