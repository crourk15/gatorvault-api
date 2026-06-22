#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function audit(html, label) {
  const headEnd = html.indexOf('</head>');
  const head = html.slice(0, headEnd);
  const body = html.slice(headEnd);
  const bodyScriptsFull = [...body.matchAll(/<script[^>]*>/gi)].map((m) => m[0]);
  const headScripts = [...head.matchAll(/<script[^>]*>/gi)].map((m) => m[0]);
  const bodyScripts = bodyScriptsFull;
  const chunkInBody = bodyScripts.filter((s) => /vault-chunks|_next\/static\/chunks/i.test(s));
  const chunkBeforeRoot = (() => {
    const rootIdx = html.indexOf('id="gv-vault-root"');
    if (rootIdx < 0) return 0;
    return chunkInBody.filter((tag) => html.indexOf(tag) >= 0 && html.indexOf(tag) < rootIdx).length;
  })();
  const asyncInHead = headScripts.filter((s) => /\basync\b/i.test(s));
  const deferInHead = headScripts.filter((s) => /\bdefer\b/i.test(s));
  const asyncInBody = bodyScripts.filter((s) => /\basync\b/i.test(s));
  const deferInBody = bodyScripts.filter((s) => /\bdefer\b/i.test(s));
  const chunkInHead = headScripts.filter((s) => /vault-chunks|_next\/static\/chunks/i.test(s));
  const build = html.match(/gatorvault-build[^>]+content="([^"]+)"/)?.[1];
  const hasGuard = html.includes('__gvHydrationBoot');
  const hasRoot = html.includes('gv-vault-root');
  console.log(`\n=== ${label} ===`);
  console.log({
    build,
    hasGuard,
    hasRoot,
    scriptsHead: headScripts.length,
    scriptsBody: bodyScripts.length,
    chunkScriptsInHead: chunkInHead.length,
    chunkScriptsBeforeRoot: chunkBeforeRoot,
    asyncInHead: asyncInHead.length,
    deferInHead: deferInHead.length,
    asyncInBody: asyncInBody.length,
    deferInBody: deferInBody.length,
  });
  if (chunkInHead.length) console.log('BAD head chunks:', chunkInHead.slice(0, 3));
  if (asyncInHead.length) console.log('BAD head async:', asyncInHead.slice(0, 3));
  console.log('Body chunk scripts:', chunkInBody.length);
  console.log('Body first chunk/webpack:', bodyScripts.find((s) => /vault-chunks|webpack/i.test(s))?.slice(0, 120));
}

const local = path.join(__dirname, '..', 'server', 'vault', 'index.html');
if (fs.existsSync(local)) audit(fs.readFileSync(local, 'utf8'), 'local server/vault/index.html');

async function main() {
  const urls = process.argv.slice(2);
  if (!urls.length) urls.push('https://gatorvault.com/vault/');
  const uas = [
    ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'],
    ['iphone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'],
  ];
  for (const url of urls) {
    for (const [label, ua] of uas) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'follow' });
        const html = await res.text();
        audit(html, `live ${url} [${label}] final=${res.url}`);
      } catch (e) {
        console.error('fetch failed', url, label, e.message);
      }
    }
  }
}

main();
