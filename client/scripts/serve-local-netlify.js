#!/usr/bin/env node
/** Static server for server/ with /api proxy to Render (local mobile testing). */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = path.join(__dirname, '..', '..', 'server');
const port = Number(process.env.PORT || 8787);
const apiOrigin = process.env.API_ORIGIN || 'https://gatorvault-api.onrender.com';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}

function proxyApi(req, res) {
  const target = new URL(req.url, apiOrigin);
  const lib = target.protocol === 'https:' ? https : http;
  const upstream = lib.request(
    target,
    { method: req.method, headers: { ...req.headers, host: target.host } },
    (up) => {
      res.writeHead(up.statusCode || 502, {
        ...up.headers,
        'access-control-allow-origin': '*',
      });
      up.pipe(res);
    }
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('API proxy error');
  });
  req.pipe(upstream);
}

/** Mirror Netlify _redirects that proof depends on locally. */
function applyLocalRewrites(urlPath) {
  let clean = decodeURIComponent(String(urlPath || '').split('?')[0] || '/');
  // Webpack publicPath /_next/ + absolute /js/vault-chunks → /_next//js/...
  clean = clean.replace(/\/{2,}/g, '/');
  const vaultChunk = clean.match(/^\/_next\/js\/vault-chunks\/(.+)$/);
  if (vaultChunk) {
    return `/js/vault-chunks/${vaultChunk[1]}`;
  }
  return clean;
}

function resolveStatic(urlPath) {
  const clean = applyLocalRewrites(urlPath);
  let filePath = path.join(root, clean.replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  if (clean.startsWith('/vault/')) {
    const fallback = path.join(root, 'vault', clean.replace(/^\/vault\/?/, '').replace(/\/?$/, ''), 'index.html');
    if (fs.existsSync(fallback)) return fallback;
    const vaultRoot = path.join(root, 'vault', 'index.html');
    if (fs.existsSync(vaultRoot)) return vaultRoot;
  }
  // Asset misses must NOT fall back to HTML — that poisons webpack with "<!".
  if (
    clean.startsWith('/_next/') ||
    clean.startsWith('/js/') ||
    /\.(js|css|map|json|woff2?|png|jpe?g|svg|webp|ico)$/i.test(clean)
  ) {
    return null;
  }
  const rootIndex = path.join(root, 'index.html');
  if (fs.existsSync(rootIndex)) return rootIndex;
  return null;
}

http
  .createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    if (req.url.startsWith('/api/')) {
      proxyApi(req, res);
      return;
    }
    const file = resolveStatic(req.url);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    sendFile(res, file);
  })
  .listen(port, () => {
    console.log(`[serve-local-netlify] http://127.0.0.1:${port} (api → ${apiOrigin})`);
  });
