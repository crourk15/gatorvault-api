/**
 * Serve Next.js static FutureCast UI (server/futurecast-ui).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const UI_ROOT = path.join(__dirname, '..', 'futurecast-ui');

const STATIC_ROUTES = [
  '/futurecast',
  '/futurecast/stock',
  '/futurecast/snapshots',
  '/alerts',
  '/staff/dashboard',
];

function uiFile(...parts) {
  return path.join(UI_ROOT, ...parts);
}

function sendUiHtml(res, filePath, fallbackPath) {
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
    return true;
  }
  if (fallbackPath && fs.existsSync(fallbackPath)) {
    res.sendFile(fallbackPath);
    return true;
  }
  return false;
}

function mountFutureCastUiRoutes(app) {
  if (!fs.existsSync(UI_ROOT)) {
    console.warn(
      '[futurecast-ui] Static UI not built — run: npm run build --prefix ../client'
    );
    return;
  }

  app.use('/_next', express.static(uiFile('_next')));

  for (const route of STATIC_ROUTES) {
    app.get(route, (_req, res) => {
      const html = uiFile(route.replace(/^\//, ''), 'index.html');
      if (!sendUiHtml(res, html)) {
        res.status(404).send('FutureCast UI page not found');
      }
    });
  }

  app.get('/player/:slug', (_req, res) => {
    const html = uiFile('player', 'index.html');
    if (!sendUiHtml(res, html)) {
      res.status(404).send('FutureCast player UI not built');
    }
  });

  app.get('/portal/:slug', (_req, res) => {
    const html = uiFile('portal', 'index.html');
    if (!sendUiHtml(res, html)) {
      res.status(404).send('Portal player UI not built');
    }
  });

  app.get('/futurecast/predictions', (_req, res) => {
    res.redirect(301, '/futurecast');
  });

  console.log('[futurecast-ui] Mounted React UI:', STATIC_ROUTES.join(', '), '/player/:slug', '/portal/:slug');
}

module.exports = { mountFutureCastUiRoutes };
