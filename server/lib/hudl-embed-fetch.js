'use strict';

/**
 * Resolve a direct MP4 (and metadata) from a Hudl embed / video URL.
 */

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; GatorVaultFilmBot/1.0; +https://gatorvaultinsider.com)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`hudl_fetch_${res.status}`);
  return res.text();
}

function normalizeHudlEmbedUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/hudl\.com\/embed\/video\//i.test(s)) {
    return s.startsWith('http') ? s : `https://${s.replace(/^\/+/, '')}`;
  }
  const m = s.match(/hudl\.com\/(?:video|v)\/(\d+)\/(\d+)\/([a-f0-9]+)/i);
  if (m) return `https://www.hudl.com/embed/video/${m[1]}/${m[2]}/${m[3]}`;
  const m2 = s.match(/hudl\.com\/embed\/video\/(\d+)\/(\d+)\/([a-f0-9]+)/i);
  if (m2) return `https://www.hudl.com/embed/video/${m2[1]}/${m2[2]}/${m2[3]}`;
  return s.startsWith('http') ? s : null;
}

function extractHudlMp4FromHtml(html) {
  const text = String(html || '');
  const og = text.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)
    || text.match(/content=["']([^"']+\.mp4[^"']*)["']\s+property=["']og:video/i);
  if (og?.[1]) return og[1].replace(/&amp;/g, '&');

  const rendered = text.match(/"renderedUri"\s*:\s*"([^"]+)"/);
  if (rendered?.[1]) {
    try {
      return JSON.parse(`"${rendered[1]}"`);
    } catch {
      return rendered[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }
  }

  const hd = text.match(/"hd"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/);
  if (hd?.[1]) {
    try {
      return JSON.parse(`"${hd[1]}"`);
    } catch {
      return hd[1].replace(/\\u0026/g, '&');
    }
  }
  return null;
}

function extractHudlMetaFromHtml(html) {
  const text = String(html || '');
  const title = (text.match(/"title"\s*:\s*"([^"]+)"/) || [])[1] || null;
  const owner = (text.match(/"ownerName"\s*:\s*"([^"]+)"/) || [])[1] || null;
  const duration = (text.match(/"duration"\s*:\s*"([^"]+)"/) || [])[1] || null;
  const thumb = (text.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) || [])[1] || null;
  return {
    title: title ? title.replace(/\\u0022/g, '"') : null,
    ownerName: owner ? owner.replace(/\\u0022/g, '"') : null,
    duration,
    thumbnail: thumb || null,
  };
}

async function resolveHudlDirectMedia(hudlUrl) {
  const embedUrl = normalizeHudlEmbedUrl(hudlUrl);
  if (!embedUrl) return { ok: false, error: 'invalid_hudl_url' };
  try {
    const html = await fetchText(embedUrl);
    const mp4Url = extractHudlMp4FromHtml(html);
    const meta = extractHudlMetaFromHtml(html);
    if (!mp4Url) return { ok: false, error: 'mp4_not_found', embedUrl, meta };
    return { ok: true, embedUrl, mp4Url, meta };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), embedUrl };
  }
}

module.exports = {
  normalizeHudlEmbedUrl,
  extractHudlMp4FromHtml,
  extractHudlMetaFromHtml,
  resolveHudlDirectMedia,
};
