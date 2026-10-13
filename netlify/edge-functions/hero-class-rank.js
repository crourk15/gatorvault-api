/**
 * iPhone can keep the August class-rank HTML after the site already says #5.
 * One load of the recruiting hub clears that saved page and stamps 5th if the
 * document still has the old rank next to Royal's line.
 */
const COOKIE = 'gv-hero-rank';
const VALUE = 'class-5';

function needsBust(request) {
  const cookie = request?.headers?.get?.('cookie') || '';
  return !new RegExp(`(?:^|;\\s*)${COOKIE}=${VALUE}(?:;|$)`).test(cookie);
}

function stampRank(html) {
  if (!html.includes('Easton Royal flipped from Texas')) return html;
  let next = html.split('"classRank":"#8"').join('"classRank":"#5"');
  next = next.split('data-hero-metric="class-rank">#8<').join('data-hero-metric="class-rank">#5<');
  return next;
}

export default async (request, context) => {
  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.delete('etag');
  headers.delete('age');
  if (needsBust(request)) {
    headers.set('clear-site-data', '"cache"');
    headers.append(
      'set-cookie',
      `${COOKIE}=${VALUE}; Max-Age=1209600; Path=/; Secure; SameSite=Lax`
    );
    headers.set('x-gv-hero-rank', VALUE);
  }
  const html = stampRank(await res.text());
  headers.delete('content-length');
  return new Response(html, { status: res.status, statusText: res.statusText, headers });
};
