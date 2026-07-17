/** Quick sanity checks for Capacitor catch-all shell mapping. */
function normalize(pathname) {
  let p = pathname.replace(/\/$/, '') || '/';
  if (p.endsWith('/index.html')) p = p.slice(0, -'/index.html'.length) || '/';
  return p || '/';
}

const SHELLS = [
  [/^(\/vault\/recruiting\/player)(?:\/[^/]+)?$/, '/vault/recruiting/player/'],
  [/^(\/vault\/futurecast\/player)(?:\/[^/]+)?$/, '/vault/futurecast/player/'],
  [/^(\/vault\/players)(?:\/[^/]+)?$/, '/vault/players/'],
  [/^(\/vault\/articles)(?:\/[^/]+)?$/, '/vault/articles/'],
];

function shell(pathname) {
  const path = normalize(pathname);
  const art = path.match(/^\/articles\/([^/]+)$/);
  if (art?.[1] && art[1] !== 'detail') return '/vault/articles/';
  for (const [re, base] of SHELLS) {
    if (re.test(path)) return base;
  }
  return null;
}

function isDynamic(href) {
  const path = normalize(href.split('?')[0]);
  const mapped = path.match(/^\/articles\/([^/]+)$/)
    ? `/vault/articles/${path.split('/').pop()}`
    : path;
  const s = shell(mapped);
  if (!s) return false;
  return normalize(mapped) !== normalize(s);
}

const cases = [
  ['/vault/recruiting/player/foo', true, '/vault/recruiting/player/'],
  ['/vault/recruiting/', false, null],
  ['/vault/articles/abc', true, '/vault/articles/'],
  ['/vault/articles/', false, '/vault/articles/'],
  ['/articles/abc', true, '/vault/articles/'],
];

let failed = 0;
for (const [href, dyn, expectShell] of cases) {
  const path = href.startsWith('/articles/')
    ? `/vault/articles/${href.split('/').pop()}`
    : href;
  const gotShell = shell(path.startsWith('/articles') ? href : path);
  const gotDyn = isDynamic(href);
  if (gotDyn !== dyn || (expectShell != null && gotShell !== expectShell && dyn)) {
    console.error('FAIL', { href, gotDyn, dyn, gotShell, expectShell });
    failed += 1;
  }
}
if (failed) process.exit(1);
console.log(`ok ${cases.length} native spa nav checks`);
