/**
 * Netlify function: rich player share pages + OG JPEG cards.
 * Routes (via server/_redirects):
 *   /share/player/:slug
 *   /share/player/:slug/og.jpg
 */
const { handleSharePlayerRequest } = require('../../server/lib/share-player-card');

function resolvePathname(event) {
  const candidates = [
    event.path,
    event.rawUrl,
    event.headers && (event.headers['x-forwarded-url'] || event.headers['x-original-url']),
    event.headers && event.headers.referer,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      if (String(raw).includes('://')) {
        const u = new URL(String(raw));
        if (/share\/player\//i.test(u.pathname)) return u.pathname;
      } else if (/share\/player\//i.test(String(raw))) {
        return String(raw).split('?')[0];
      }
    } catch {
      /* try next */
    }
  }
  return event.path || '';
}

exports.handler = async (event) => {
  const host =
    (event.headers && (event.headers['x-forwarded-host'] || event.headers.host)) || '';
  const userAgent = (event.headers && event.headers['user-agent']) || '';
  const result = await handleSharePlayerRequest({
    pathname: resolvePathname(event),
    host,
    userAgent,
  });

  const response = {
    statusCode: result.statusCode,
    headers: result.headers || {},
    body: result.body || '',
  };
  if (result.isBase64Encoded) response.isBase64Encoded = true;
  return response;
};
