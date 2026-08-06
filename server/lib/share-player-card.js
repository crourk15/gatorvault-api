/**
 * Player share cards — Open Graph HTML + 1200×630 JPEG for rich link previews.
 */
const SITE_FALLBACK = 'https://gatorvaultinsider.com';
const API_FALLBACK = 'https://gatorvault-api.onrender.com';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function apiBase() {
  return String(process.env.API_PUBLIC_BASE || process.env.RENDER_EXTERNAL_URL || API_FALLBACK).replace(
    /\/$/,
    ''
  );
}

function siteBase(hostHeader) {
  const fromEnv = String(process.env.PUBLIC_SITE_ORIGIN || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (hostHeader) {
    const host = String(hostHeader).split(',')[0].trim();
    if (host) {
      const proto = host.includes('localhost') ? 'http' : 'https';
      return `${proto}://${host}`;
    }
  }
  return SITE_FALLBACK;
}

function formatComposite(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  return n <= 1 ? (n * 100).toFixed(1) : n.toFixed(1);
}

function buildShareModel(payload) {
  const player = payload?.player || {};
  const name = String(player.fullName || player.name || 'Florida recruit').trim();
  const pos = String(player.position || 'ATH').trim();
  const classYear = player.classYear ? String(player.classYear) : '';
  const stars = player.stars != null && Number(player.stars) > 0 ? Number(player.stars) : null;
  const hometown = [player.hometown, player.state].filter(Boolean).join(', ');
  const committed = String(player.committedTo || '').trim();
  const composite = formatComposite(player.compositeRating);
  const natl = player.rankingNational != null ? `#${player.rankingNational} NATL` : null;
  const fit =
    payload?.futurecastSummary?.fitScore != null
      ? Math.round(Number(payload.futurecastSummary.fitScore))
      : player.ufFitScore != null
        ? Math.round(Number(player.ufFitScore))
        : null;

  const statusLine = committed
    ? `Committed to ${committed}`
    : classYear
      ? `Class of ${classYear} target`
      : 'Florida recruiting';

  const metaBits = [
    stars != null ? `${stars}★ ${pos}` : pos,
    hometown || null,
    natl,
    composite ? `Composite ${composite}` : null,
  ].filter(Boolean);

  const title = committed
    ? `${name} · ${stars != null ? `${stars}★ ` : ''}${pos} · Florida Commit | GatorVault`
    : `${name} · ${stars != null ? `${stars}★ ` : ''}${pos} | GatorVault`;

  const description = `${statusLine}. ${metaBits.join(' · ')}. Open the full Vault profile for film, board picture, and intel.`;

  return {
    name,
    pos,
    classYear,
    stars,
    hometown,
    committed,
    composite,
    natl,
    fit,
    statusLine,
    metaBits,
    title,
    description,
    slug: String(player.slug || '').trim(),
  };
}

function buildShareSvg(model) {
  const starLine = model.stars != null ? `${model.stars}★ ${model.pos}` : model.pos;
  const rankLine = [model.natl, model.composite ? `COMP ${model.composite}` : null, model.fit != null ? `FIT ${model.fit}` : null]
    .filter(Boolean)
    .join('   ');
  const home = model.hometown || (model.classYear ? `Class of ${model.classYear}` : 'Florida Gators');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00144f"/>
      <stop offset="55%" stop-color="#0021a5"/>
      <stop offset="100%" stop-color="#0a2a8c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fa4616"/>
      <stop offset="100%" stop-color="#0021a5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="520" r="180" fill="#fa4616" fill-opacity="0.16"/>
  <circle cx="160" cy="80" r="140" fill="#ffffff" fill-opacity="0.05"/>
  <rect x="0" y="0" width="1200" height="10" fill="url(#accent)"/>
  <text x="72" y="92" fill="#fdba74" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" letter-spacing="4">GATORVAULT</text>
  <text x="72" y="150" fill="#93c5fd" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="3">${esc(starLine.toUpperCase())}${model.classYear ? ` · CLASS OF ${esc(model.classYear)}` : ''}</text>
  <text x="72" y="260" fill="#ffffff" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="72" font-weight="900">${esc(model.name)}</text>
  <text x="72" y="320" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="30">${esc(home)}</text>
  <rect x="72" y="360" width="${Math.min(520, 40 + model.statusLine.length * 14)}" height="54" rx="10" fill="#fa4616"/>
  <text x="92" y="396" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">${esc(model.statusLine.toUpperCase())}</text>
  <text x="72" y="490" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${esc(rankLine)}</text>
  <text x="72" y="570" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="22">Florida recruiting · board · film · intel</text>
</svg>`;
}

async function renderShareJpeg(model) {
  const path = require('path');
  let sharp = null;
  const candidates = [
    'sharp',
    path.join(__dirname, '..', 'node_modules', 'sharp'),
    path.join(__dirname, '..', '..', 'node_modules', 'sharp'),
  ];
  for (const id of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      sharp = require(id);
      break;
    } catch {
      /* try next */
    }
  }
  if (!sharp) return null;
  const svg = Buffer.from(buildShareSvg(model));
  return sharp(svg, { density: 144 })
    .resize(1200, 630, { fit: 'fill' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

function buildShareHtml({ model, shareUrl, profileUrl, imageUrl }) {
  const title = esc(model.title);
  const description = esc(model.description);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${esc(profileUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="GatorVault" />
  <meta property="og:url" content="${esc(shareUrl)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta property="og:image:secure_url" content="${esc(imageUrl)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(model.name)} — GatorVault" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${esc(profileUrl)}" />
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#00144f;color:#fff;display:grid;place-items:center;min-height:100vh}
    a{color:#fdba74}
  </style>
</head>
<body>
  <p>Opening <a href="${esc(profileUrl)}">${esc(model.name)}</a> on GatorVault…</p>
  <script>location.replace(${JSON.stringify(profileUrl)});</script>
</body>
</html>`;
}

async function fetchSharePayload(slug) {
  const url = `${apiBase()}/api/player/full-profile/${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'GatorVaultShareCard/1.0' },
  });
  if (!res.ok) {
    const err = new Error(`Profile fetch failed (${res.status})`);
    err.statusCode = res.status;
    throw err;
  }
  return res.json();
}

function parseSharePath(pathname) {
  const clean = String(pathname || '').split('?')[0].replace(/\/+$/, '');
  const match = clean.match(/\/(?:api\/)?share\/player\/([^/]+)(?:\/(og\.jpg))?$/i);
  if (!match) return null;
  return {
    slug: decodeURIComponent(match[1]),
    wantImage: Boolean(match[2]),
  };
}

async function handleSharePlayerRequest({ pathname, host, protocol }) {
  const parsed = parseSharePath(pathname);
  if (!parsed?.slug) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not found' };
  }

  const site = siteBase(host);
  const shareUrl = `${site}/share/player/${encodeURIComponent(parsed.slug)}`;
  const profileUrl = `${site}/vault/recruiting/player/${encodeURIComponent(parsed.slug)}`;
  const imageUrl = `${shareUrl}/og.jpg`;

  let payload;
  try {
    payload = await fetchSharePayload(parsed.slug);
  } catch (err) {
    const statusCode = err.statusCode || 502;
    return {
      statusCode,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Player share card unavailable',
    };
  }

  const model = buildShareModel(payload);
  if (!model.slug) model.slug = parsed.slug;

  if (parsed.wantImage) {
    const jpeg = await renderShareJpeg(model);
    if (!jpeg) {
      // Fallback: redirect crawlers to brand OG asset.
      return {
        statusCode: 302,
        headers: { Location: `${site}/og-image.jpg` },
        body: '',
      };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
      body: jpeg.toString('base64'),
      isBase64Encoded: true,
      rawBody: jpeg,
    };
  }

  const html = buildShareHtml({ model, shareUrl, profileUrl, imageUrl });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120, s-maxage=300',
    },
    body: html,
  };
}

function mountSharePlayerRoutes(app) {
  const send = async (req, res) => {
    const host = req.get('x-forwarded-host') || req.get('host');
    const result = await handleSharePlayerRequest({
      pathname: req.path,
      host,
    });
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    }
    if (result.rawBody) {
      res.status(result.statusCode).send(result.rawBody);
      return;
    }
    res.status(result.statusCode).send(result.body);
  };

  app.get('/api/share/player/:slug/og.jpg', send);
  app.get('/api/share/player/:slug', send);
  app.get('/share/player/:slug/og.jpg', send);
  app.get('/share/player/:slug', send);
}

module.exports = {
  buildShareModel,
  buildShareSvg,
  buildShareHtml,
  handleSharePlayerRequest,
  mountSharePlayerRoutes,
  parseSharePath,
};
