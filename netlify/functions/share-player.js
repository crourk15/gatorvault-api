/**
 * Netlify function: rich player share pages + OG JPEG cards.
 * Routes (via server/_redirects):
 *   /share/player/:slug
 *   /share/player/:slug/og.jpg
 */
const { handleSharePlayerRequest } = require('../../server/lib/share-player-card');

exports.handler = async (event) => {
  const host = event.headers['x-forwarded-host'] || event.headers.host || '';
  const result = await handleSharePlayerRequest({
    pathname: event.path || '',
    host,
  });

  const response = {
    statusCode: result.statusCode,
    headers: result.headers || {},
    body: result.body || '',
  };
  if (result.isBase64Encoded) response.isBase64Encoded = true;
  return response;
};
