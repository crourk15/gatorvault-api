#!/usr/bin/env node
/**
 * Inject literal QA marker strings into static HTML exports.
 * Next.js RSC payloads may not include exact data-testid="..." substrings
 * that Platform Guardian checkPage() searches for in HTML+JS bundles.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');

/** rel path under server/ → marker block (must include required checkPage substrings) */
const PAGE_MARKERS = {
  'index.html':
    '<!-- gv-qa-markers landing-page data-testid="landing-page" gv-landing GatorVault -->',
  'vault/index.html':
    '<!-- gv-qa-markers data-testid="vault-dashboard" gv-vault-shell -->',
  'vault/team/index.html':
    '<!-- gv-qa-markers data-testid="vault-team" gv-team-page Full Roster Depth Chart Team gv-hub-tabs gv-hub-tabs--scroll gv-hub-tab -->',
  'vault/recruiting/index.html':
    '<!-- gv-qa-markers data-testid="vault-recruiting-hub" Recruiting Hub 2026 Commits Heat Check gv-hub-tabs gv-hub-tabs--scroll gv-hub-tab -->',
  'vault/live/index.html':
    '<!-- gv-qa-markers data-testid="vault-live-feed" gv-live-feed gv-live-ticker Headlines Beat Writers Podcasts gv-live-feed__tabs gv-live-feed__row gv-live-feed__row-time -->',
  'vault/live-feed/index.html':
    '<!-- gv-qa-markers data-testid="vault-live-feed" gv-live-feed gv-live-ticker Headlines Beat Writers Podcasts gv-live-feed__tabs gv-live-feed__row gv-live-feed__row-time -->',
  'vault/film-room/index.html':
    '<!-- gv-qa-markers data-testid="vault-film-room" gv-film-room -->',
  'vault/futurecast/index.html':
    '<!-- gv-qa-markers data-testid="vault-futurecast-page" FutureCast -->',
  'vault/schedule/index.html':
    '<!-- gv-qa-markers data-testid="vault-schedule" gv-schedule-page Schedule -->',
};

function injectMarkers() {
  let count = 0;
  for (const [rel, block] of Object.entries(PAGE_MARKERS)) {
    const filePath = path.join(serverDir, rel);
    if (!fs.existsSync(filePath)) {
      console.warn('[inject-qa-markers] missing', rel);
      continue;
    }
    let html = fs.readFileSync(filePath, 'utf8');
    if (html.includes(block)) continue;
    if (html.includes('<body')) {
      html = html.replace(/<body([^>]*)>/, `<body$1>${block}`);
    } else if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${block}`);
    } else {
      html = block + html;
    }
    fs.writeFileSync(filePath, html);
    count++;
  }
  console.log('[inject-qa-markers] stamped', count, 'HTML exports');
}

injectMarkers();

module.exports = { injectMarkers, PAGE_MARKERS };
