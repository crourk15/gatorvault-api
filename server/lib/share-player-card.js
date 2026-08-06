/**
 * Player share cards — Open Graph HTML + 1200x630 JPEG for rich link previews.
 * Works offline from recruiting players.json when the live API is down.
 * JPEG text is drawn as SVG paths (opentype) so Netlify needs no system fonts.
 */
const fs = require('fs');
const path = require('path');

const SITE_FALLBACK = 'https://gatorvaultinsider.com';
const API_FALLBACK = 'https://gatorvault-api.onrender.com';

const CRAWLER_UA_RE =
  /Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|bingbot|SkypeUriPreview|Slack-ImgProxy|Embedly|Quora Link Preview|redditbot|Showyoubot|Outbrain|Pinterest|W3C_Validator|Baiduspider|DuckDuckBot/i;

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

function isShareCrawler(userAgent) {
  return CRAWLER_UA_RE.test(String(userAgent || ''));
}

function formatComposite(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  return n <= 1 ? (n * 100).toFixed(1) : n.toFixed(1);
}

function buildShareModel(payload) {
  const player = payload?.player || {};
  const name = String(player.fullName || player.name || 'Florida recruit').trim();
  const pos = String(player.position || player.pos || 'ATH').trim();
  const classYear = player.classYear ? String(player.classYear) : '';
  const stars = player.stars != null && Number(player.stars) > 0 ? Number(player.stars) : null;
  const hometown =
    [player.hometown, player.state].filter(Boolean).join(', ') ||
    [player.hometownCity, player.hometownState].filter(Boolean).join(', ');
  const committed = String(player.committedTo || '').trim();
  const composite = formatComposite(
    player.compositeRating != null ? player.compositeRating : player.rating
  );
  const natlRank = player.rankingNational != null ? player.rankingNational : player.natlRank;
  const natl = natlRank != null ? `#${natlRank} NATL` : null;
  const fit =
    payload?.futurecastSummary?.fitScore != null
      ? Math.round(Number(payload.futurecastSummary.fitScore))
      : player.ufFitScore != null
        ? Math.round(Number(player.ufFitScore))
        : player.fitScore != null
          ? Math.round(Number(player.fitScore))
          : null;

  const statusLine = committed
    ? `Committed to ${committed}`
    : classYear
      ? `Class of ${classYear} target`
      : 'Florida recruiting';

  const metaBits = [
    stars != null ? `${stars}\u2605 ${pos}` : pos,
    hometown || null,
    natl,
    composite ? `Composite ${composite}` : null,
  ].filter(Boolean);

  const title = committed
    ? `${name} \u00b7 ${stars != null ? `${stars}\u2605 ` : ''}${pos} \u00b7 Florida Commit | GatorVault`
    : `${name} \u00b7 ${stars != null ? `${stars}\u2605 ` : ''}${pos} | GatorVault`;

  const description = `${statusLine}. ${metaBits.join(' \u00b7 ')}. Open the full Vault profile for film, board picture, and intel.`;

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

function asciiShareText(value) {
  return String(value ?? '')
    .replace(/\u2605/g, '*')
    .replace(/★/g, '*')
    .replace(/·/g, '|')
    .replace(/—/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

let cachedFont = null;
function loadShareFont() {
  if (cachedFont) return cachedFont;
  let opentype = null;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    opentype = require('opentype.js');
  } catch (err) {
    console.warn('[share-card] opentype.js unavailable', err && err.message);
    return null;
  }
  const candidates = [
    path.join(__dirname, '../assets/fonts/Arimo-Bold.ttf'),
    path.join(__dirname, '../../server/assets/fonts/Arimo-Bold.ttf'),
    path.join(__dirname, 'share-fonts/Arimo-Bold.ttf'),
    path.join(__dirname, '../share-fonts/Arimo-Bold.ttf'),
    path.join(process.cwd(), 'server/assets/fonts/Arimo-Bold.ttf'),
    path.join(process.cwd(), 'assets/fonts/Arimo-Bold.ttf'),
    path.join(process.cwd(), 'share-fonts/Arimo-Bold.ttf'),
    path.join(process.cwd(), 'netlify/functions/share-fonts/Arimo-Bold.ttf'),
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      cachedFont = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      return cachedFont;
    } catch (err) {
      console.warn('[share-card] font parse failed', filePath, err && err.message);
    }
  }
  console.warn('[share-card] no share font found', candidates);
  return null;
}

function textPath(font, text, x, y, size) {
  if (!font) return '';
  const p = font.getPath(String(text || ''), x, y, size);
  return p.toPathData(1);
}

function pathEl(d, fill, opacity) {
  if (!d) return '';
  const op = opacity == null ? '' : ` fill-opacity="${opacity}"`;
  return `<path fill="${fill}"${op} d="${d}"/>`;
}

function buildShareSvg(model) {
  const font = loadShareFont();
  const starBit =
    model.stars != null
      ? asciiShareText(`${model.stars}* ${model.pos}`)
      : asciiShareText(model.pos);
  const metaLine = asciiShareText(
    [starBit, model.classYear ? `CLASS OF ${model.classYear}` : null].filter(Boolean).join('  |  ')
  );
  const rankLine = asciiShareText(
    [
      model.natl,
      model.composite ? `COMP ${model.composite}` : null,
      model.fit != null ? `FIT ${model.fit}` : null,
    ]
      .filter(Boolean)
      .join('    ')
  );
  const home = asciiShareText(
    model.hometown || (model.classYear ? `Class of ${model.classYear}` : 'Florida Gators')
  );
  const status = asciiShareText(model.statusLine).toUpperCase();
  const name = asciiShareText(model.name);
  const statusAdvance =
    font && typeof font.getAdvanceWidth === 'function'
      ? font.getAdvanceWidth(status, 28)
      : status.length * 17;
  const stampWidth = Math.min(640, Math.max(300, Math.ceil(statusAdvance + 56)));

  // Prefer path text (Netlify-safe). Fall back to <text> only if font missing locally.
  const usePaths = Boolean(font);
  const brand = usePaths
    ? pathEl(textPath(font, 'GATORVAULT', 72, 88, 30), '#fdba74')
    : `<text x="72" y="88" fill="#fdba74" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">GATORVAULT</text>`;
  const meta = usePaths
    ? pathEl(textPath(font, metaLine, 72, 150, 28), '#93c5fd')
    : `<text x="72" y="150" fill="#93c5fd" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${esc(metaLine)}</text>`;
  const nameEl = usePaths
    ? pathEl(textPath(font, name, 72, 270, 76), '#ffffff')
    : `<text x="72" y="270" fill="#ffffff" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="76" font-weight="700">${esc(name)}</text>`;
  const homeEl = usePaths
    ? pathEl(textPath(font, home, 72, 330, 32), '#dbeafe')
    : `<text x="72" y="330" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700">${esc(home)}</text>`;
  const statusEl = usePaths
    ? pathEl(textPath(font, status, 96, 410, 28), '#ffffff')
    : `<text x="96" y="410" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${esc(status)}</text>`;
  const rankEl = usePaths
    ? pathEl(textPath(font, rankLine, 72, 500, 30), '#e2e8f0')
    : `<text x="72" y="490" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">${esc(rankLine)}</text>`;
  const footEl = usePaths
    ? pathEl(textPath(font, 'Florida recruiting  |  board  |  film  |  intel', 72, 575, 22), '#94a3b8')
    : `<text x="72" y="570" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="22">Florida recruiting | board | film | intel</text>`;
  const ufMark = usePaths
    ? pathEl(textPath(font, 'UF', 980, 560, 140), '#ffffff', 0.06)
    : `<text x="1180" y="560" text-anchor="end" fill="#ffffff" fill-opacity="0.06" font-size="140" font-weight="700">UF</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00144f"/>
      <stop offset="50%" stop-color="#0021a5"/>
      <stop offset="100%" stop-color="#0a1f6e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fa4616"/>
      <stop offset="100%" stop-color="#ff7a45"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="520" r="210" fill="#fa4616" fill-opacity="0.14"/>
  <circle cx="140" cy="70" r="160" fill="#ffffff" fill-opacity="0.05"/>
  ${ufMark}
  <rect x="0" y="0" width="1200" height="12" fill="url(#accent)"/>
  <rect x="0" y="0" width="14" height="630" fill="#fa4616"/>
  ${brand}
  ${meta}
  ${nameEl}
  ${homeEl}
  <rect x="72" y="370" width="${stampWidth}" height="58" rx="12" fill="#fa4616"/>
  ${statusEl}
  ${rankEl}
  ${footEl}
</svg>`;
}

function resolveSharp() {
  const candidates = [
    'sharp',
    path.join(__dirname, '..', 'node_modules', 'sharp'),
    path.join(__dirname, '..', '..', 'node_modules', 'sharp'),
    path.join(process.cwd(), 'node_modules', 'sharp'),
  ];
  for (const id of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(id);
    } catch {
      /* try next */
    }
  }
  return null;
}

async function renderShareJpeg(model) {
  const sharp = resolveSharp();
  if (!sharp) return null;
  const svg = Buffer.from(buildShareSvg(model));
  return sharp(svg, { density: 144 })
    .resize(1200, 630, { fit: 'fill' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

function buildShareHtml({ model, shareUrl, profileUrl, imageUrl, crawler }) {
  const title = esc(model.title);
  const description = esc(model.description);
  const refresh = crawler
    ? ''
    : `
  <meta http-equiv="refresh" content="0;url=${esc(profileUrl)}" />
  <script>location.replace(${JSON.stringify(profileUrl)});</script>`;
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
  <meta property="og:image:alt" content="${esc(model.name)} - GatorVault" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />${refresh}
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#00144f;color:#fff;display:grid;place-items:center;min-height:100vh}
    a{color:#fdba74}
  </style>
</head>
<body>
  <p>Opening <a href="${esc(profileUrl)}">${esc(model.name)}</a> on GatorVault...</p>
</body>
</html>`;
}

function playerJsonCandidates() {
  return [
    path.join(__dirname, '../data/recruiting/players.json'),
    path.join(__dirname, '../../server/data/recruiting/players.json'),
    path.join(__dirname, '../../data/recruiting/players.json'),
    path.join(process.cwd(), 'server/data/recruiting/players.json'),
    path.join(process.cwd(), 'data/recruiting/players.json'),
  ];
}

let cachedPlayers = null;
let cachedPlayersPath = null;

function loadRecruitingPlayers() {
  if (cachedPlayers) return cachedPlayers;
  for (const filePath of playerJsonCandidates()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const rows = Array.isArray(raw) ? raw : raw.players || raw.items || [];
      if (!rows.length) continue;
      cachedPlayers = rows;
      cachedPlayersPath = filePath;
      return cachedPlayers;
    } catch {
      /* try next */
    }
  }
  return null;
}

function loadBundledOgPlayers() {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require('../data/share/og-players.json');
  } catch {
    return null;
  }
}

function loadLocalSharePayload(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  const bundled = loadBundledOgPlayers();
  const row = bundled
    ? bundled[key]
    : (loadRecruitingPlayers() || []).find((p) => String(p.slug || p.id || '').toLowerCase() === key);
  if (!row) return null;
  return {
    player: {
      slug: row.slug || key,
      name: row.name,
      fullName: row.name,
      position: row.pos || row.position || 'ATH',
      pos: row.pos || row.position || 'ATH',
      classYear: row.classYear,
      stars: row.stars,
      hometown: row.hometown || row.hometownCity || null,
      state: row.state || row.hometownState || null,
      hometownCity: row.hometownCity,
      hometownState: row.hometownState,
      committedTo: row.committedTo,
      status: row.status,
      compositeRating: row.compositeRating != null ? row.compositeRating : row.rating,
      rating: row.rating,
      rankingNational: row.rankingNational != null ? row.rankingNational : row.natlRank,
      natlRank: row.natlRank,
      ufFitScore: row.ufFitScore != null ? row.ufFitScore : row.fitScore,
      fitScore: row.fitScore,
    },
    futurecastSummary: row.fitScore != null ? { fitScore: row.fitScore } : null,
    source: bundled ? 'bundled-og-players' : 'local-players-json',
    sourcePath: cachedPlayersPath,
  };
}

async function fetchSharePayload(slug) {
  const url = `${apiBase()}/api/player/full-profile/${encodeURIComponent(slug)}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 2500) : null;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GatorVaultShareCard/1.0' },
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) {
      const err = new Error(`Profile fetch failed (${res.status})`);
      err.statusCode = res.status;
      throw err;
    }
    return res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveSharePayload(slug) {
  try {
    return await fetchSharePayload(slug);
  } catch {
    const local = loadLocalSharePayload(slug);
    if (local) return local;
    const err = new Error('Player share card unavailable');
    err.statusCode = 502;
    throw err;
  }
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

async function handleSharePlayerRequest({ pathname, host, protocol, userAgent }) {
  const parsed = parseSharePath(pathname);
  if (!parsed?.slug) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not found' };
  }

  const site = siteBase(host);
  const shareUrl = `${site}/share/player/${encodeURIComponent(parsed.slug)}`;
  const profileUrl = `${site}/vault/futurecast/player/${encodeURIComponent(parsed.slug)}`;
  const imageUrl = `${shareUrl}/og.jpg`;
  const crawler = isShareCrawler(userAgent);

  let payload;
  try {
    payload = await resolveSharePayload(parsed.slug);
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

  const html = buildShareHtml({ model, shareUrl, profileUrl, imageUrl, crawler });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': crawler
        ? 'public, max-age=300, s-maxage=600'
        : 'public, max-age=120, s-maxage=300',
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
      userAgent: req.get('user-agent'),
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
  loadLocalSharePayload,
  isShareCrawler,
  resolveSharePayload,
};
