#!/usr/bin/env node
/**
 * Inject early cache-bust boot script into every exported HTML shell.
 * Unregisters stale service workers, clears Cache API, reloads once on build ID change.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');

function readBuildId() {
  const manifestPath = path.join(serverDir, 'build-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const id = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).buildId;
      if (id) return id;
    } catch {
      /* fall through */
    }
  }
  const fromNext = require('./inject-landing-export.js').readNextBuildId();
  if (fromNext) return fromNext;
  return `t${Date.now().toString(36)}`;
}

function cacheBustScript(buildId) {
  const safeId = String(buildId).replace(/[^a-zA-Z0-9._-]/g, '');
  return (
    `<script data-gv-cache-bust="">(function(){try{var b="${safeId}";var k="gv-build-id";` +
    `var p=localStorage.getItem(k);localStorage.setItem(k,b);` +
    `if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})})}` +
    `if("caches"in window){caches.keys().then(function(keys){keys.forEach(function(n){caches.delete(n)})})}` +
    `if(p&&p!==b&&!/[?&]gv-cache-reload=1/.test(location.search)&&!sessionStorage.getItem("gv-cache-reloaded")){` +
    `sessionStorage.setItem("gv-cache-reloaded","1");` +
    `var reload=function(){var u=new URL(location.href);u.searchParams.set("gv-cache-reload","1");location.replace(u.toString())};` +
    `var maybeReload=function(){if(document.getElementById("gv-vault-root")||document.querySelector(".home-wow-hero,.gv-landing-hero")){requestAnimationFrame(function(){setTimeout(reload,120)})}else{reload()}};` +
    `if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",maybeReload,{once:true})}else{maybeReload()}` +
    `}` +
    `}catch(e){}})();</script>`
  );
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function patchHtml(html, tag) {
  let next = html.replace(/<script data-gv-cache-bust="">[\s\S]*?<\/script>/, '');
  const reactScript = next.search(/<script[^>]+src=["']/i);
  if (reactScript >= 0) {
    return next.slice(0, reactScript) + tag + next.slice(reactScript);
  }
  if (next.includes('</head>')) return next.replace('</head>', `${tag}</head>`);
  return tag + next;
}

function injectCacheBust() {
  const buildId = readBuildId();
  const tag = cacheBustScript(buildId);
  const files = walkHtml(serverDir);
  let updated = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const patched = patchHtml(html, tag);
    if (patched !== html) {
      fs.writeFileSync(file, patched);
      updated++;
    }
  }
  console.log(`[inject-cache-bust] buildId=${buildId} patched ${updated}/${files.length} HTML shells`);
}

injectCacheBust();

module.exports = { injectCacheBust, cacheBustScript };
