const { fetchText } = require('../lib/qa/qa-utils');

async function dump(slug) {
  const url = `https://www.on3.com/rivals/${slug}/`;
  const { text } = await fetchText(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    timeout: 45000
  });
  const m = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const pp = JSON.parse(m[1])?.props?.pageProps;
  const rp = pp?.rankingsPlayer || {};
  const rating = pp?.recruitments?.[0]?.rating || {};
  console.log('\n===', slug, '===');
  console.log('rankingsPlayer', JSON.stringify(rp, null, 2).slice(0, 1500));
  console.log('recruitment.rating', JSON.stringify(rating, null, 2));
}

(async () => {
  for (const s of ['ryan-drakeford-242808', 'man-robinson-260972', 'merrick-ham-261594', 'bryce-willingham-261593']) {
    await dump(s);
  }
})();
