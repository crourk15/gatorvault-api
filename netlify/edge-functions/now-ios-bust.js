/**
 * One-shot WKWebView URLCache bust on iOS 1.0.29 launch paths.
 * Those builds fetch without cache: no-store, so leftover NOW (Bailey /
 * ABC-or-SECN) can sit in URLCache even after origin is clean.
 * POST /api/push/device always hits the network on App Store launch.
 * Do not rewrite the body -- auth / APNs POSTs must pass through.
 */
const NOW_BUST_COOKIE = 'gv-now-bust';
const NOW_BUST_VALUE = 'scar-board-ios';

function needsNowCacheBust(request) {
  const cookie = request?.headers?.get?.('cookie') || '';
  return !new RegExp(`(?:^|;\\s*)${NOW_BUST_COOKIE}=${NOW_BUST_VALUE}(?:;|$)`).test(cookie);
}

export default async (request, context) => {
  const res = await context.next();
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  if (needsNowCacheBust(request)) {
    headers.set('clear-site-data', '"cache"');
    headers.append(
      'set-cookie',
      `${NOW_BUST_COOKIE}=${NOW_BUST_VALUE}; Max-Age=1209600; Path=/; Secure; SameSite=Lax`
    );
    headers.set('x-gv-now-bust', NOW_BUST_VALUE);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
