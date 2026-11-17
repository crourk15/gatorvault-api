/**
 * If a cached recruiting document still says class rank 8th or 5th next to Royal,
 * stamp 6th (On3 Industry, Nov 17 2026). Do not send Clear-Site-Data on this
 * document: that header wipes scripts while the vault page is loading.
 */
function stampRank(html) {
  if (!html.includes('Easton Royal flipped from Texas')) return html;
  let next = html.split('"classRank":"#8"').join('"classRank":"#6"');
  next = next.split('"classRank":"#5"').join('"classRank":"#6"');
  next = next.split('data-hero-metric="class-rank">#8<').join('data-hero-metric="class-rank">#6<');
  next = next.split('data-hero-metric="class-rank">#5<').join('data-hero-metric="class-rank">#6<');
  next = next.split('No. 5 nationally').join('No. 7 nationally');
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
  headers.delete('clear-site-data');
  const html = stampRank(await res.text());
  headers.delete('content-length');
  return new Response(html, { status: res.status, statusText: res.statusText, headers });
};
