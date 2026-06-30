#!/usr/bin/env node
/**
 * Ensure vault static HTML includes hydration boot script + critical CSS.
 * Boot must run AFTER #gv-vault-root so the SSR snapshot is captured on mobile Safari.
 */
const fs = require('fs');
const path = require('path');
const {
  VAULT_HYDRATION_BOOT_SCRIPT,
  VAULT_HYDRATION_CRITICAL_CSS,
} = require('../lib/vault-hydration-guard.js');

const serverDir = path.join(__dirname, '..', '..', 'server');
const vaultDir = path.join(serverDir, 'vault');

const BOOT_TAG = `<script data-gv-hydration-boot="">${VAULT_HYDRATION_BOOT_SCRIPT}</script>`;
const CSS_TAG = `<style data-gv-hydration-css="">${VAULT_HYDRATION_CRITICAL_CSS}</style>`;
const API_WARM_TAG =
  '<script data-gv-api-warm="">(function(){try{var Y=2027;var p=function(u){fetch(u,{cache:"no-store",credentials:"same-origin"}).catch(function(){})};var run=function(){try{p("/api/ping");p("/api/health");p("/api/recruiting/hub/bundle?year="+Y);p("/api/recruiting/class-metrics?year="+Y);p("/api/recruiting/class-metrics?year=2026");p("/api/recruiting/class-metrics?year=2028");p("/api/recruiting/hub/ticker?year="+Y);p("/api/futurecast/home");p("/api/futurecast/master-board");p("/api/roster/players?limit=1");p("/api/team/coaching-staff")}catch(e){}};run();if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run,{once:true})}}catch(e){}})();</script>';

function walkVaultHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVaultHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function stripExistingBoot(html) {
  return html
    .replace(/<script data-gv-api-warm="">[\s\S]*?<\/script>/gi, '')
    .replace(/<script data-gv-hydration-boot="">[\s\S]*?<\/script>/gi, '');
}

function insertAfterVaultRoot(html, insertion) {
  const marker = 'id="gv-vault-root"';
  const start = html.indexOf(marker);
  if (start < 0) {
    if (html.includes('</body>')) return html.replace('</body>', `${insertion}</body>`);
    return html + insertion;
  }
  let idx = html.indexOf('>', start) + 1;
  let depth = 1;
  while (idx < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', idx);
    const nextClose = html.indexOf('</div>', idx);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      idx = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) {
        const at = nextClose + 6;
        return html.slice(0, at) + insertion + html.slice(at);
      }
      idx = nextClose + 6;
    }
  }
  if (html.includes('</body>')) return html.replace('</body>', `${insertion}</body>`);
  return html + insertion;
}

function patchHtml(html) {
  let next = html;

  if (!next.includes('data-gv-hydration-css')) {
    if (next.includes('</head>')) next = next.replace('</head>', `${CSS_TAG}</head>`);
    else next = CSS_TAG + next;
  }

  next = stripExistingBoot(next);

  if (next.includes('id="gv-vault-root"')) {
    next = insertAfterVaultRoot(next, API_WARM_TAG + BOOT_TAG);
  } else if (next.includes('</body>')) {
    next = next.replace('</body>', `${API_WARM_TAG}${BOOT_TAG}</body>`);
  } else {
    next += API_WARM_TAG + BOOT_TAG;
  }

  if (next.includes('id="gv-vault-root"') && !next.includes('data-hydrating="true"')) {
    next = next.replace('id="gv-vault-root"', 'id="gv-vault-root" data-hydrating="true"');
  }

  return next;
}

function injectVaultHydrationGuard() {
  const files = walkVaultHtml(vaultDir);
  let updated = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const patched = patchHtml(html);
    if (patched !== html) {
      fs.writeFileSync(file, patched);
      updated++;
    }
  }
  console.log(`[inject-vault-hydration] patched ${updated}/${files.length} vault HTML exports`);
}

injectVaultHydrationGuard();

module.exports = { injectVaultHydrationGuard, insertAfterVaultRoot, patchHtml };
