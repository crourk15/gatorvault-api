#!/usr/bin/env node
/**
 * Inject recruiting hub preload/preconnect links into exported vault/recruiting HTML.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');
const targets = [
  'vault/recruiting/index.html',
  'recruiting-hub/index.html',
  'recruiting/index.html',
];

const YEAR = process.env.HUB_WARM_YEARS?.split(',')?.[1]?.trim() || '2027';
const apiBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const MARKER = 'data-gv-recruiting-hub-preload';

function buildTags() {
  const hero = `/api/recruiting/hub/hero?year=${YEAR}`;
  const bundle = `/api/recruiting/hub/bundle?year=${YEAR}`;
  const preconnect = apiBase
    ? `<link rel="preconnect" href="${apiBase}" crossorigin ${MARKER} />`
    : '';
  return `${preconnect}<link rel="preload" href="${hero}" as="fetch" crossorigin ${MARKER} /><link rel="preload" href="${bundle}" as="fetch" crossorigin ${MARKER} />`;
}

function patchHtml(html) {
  if (html.includes(MARKER)) return html;
  const tags = buildTags();
  if (html.includes('</head>')) return html.replace('</head>', `${tags}</head>`);
  return tags + html;
}

function injectRecruitingHubPreload() {
  let updated = 0;
  for (const rel of targets) {
    const file = path.join(serverDir, rel);
    if (!fs.existsSync(file)) continue;
    const prev = fs.readFileSync(file, 'utf8');
    const next = patchHtml(prev);
    if (next !== prev) {
      fs.writeFileSync(file, next);
      updated += 1;
      console.log('[inject-recruiting-hub-preload] patched', rel);
    }
  }
  if (!updated) console.log('[inject-recruiting-hub-preload] nothing to patch');
}

injectRecruitingHubPreload();
