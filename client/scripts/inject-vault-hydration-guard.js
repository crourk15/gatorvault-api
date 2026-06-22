#!/usr/bin/env node
/**
 * Ensure vault static HTML includes hydration boot script + critical CSS before React scripts.
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
/** Wake Render API while JS chunks download — before React mounts. */
const API_WARM_TAG =
  '<script data-gv-api-warm="">(function(){try{var p=function(u){fetch(u,{cache:"no-store",credentials:"same-origin"}).catch(function(){})};p("/api/health");p("/api/ping");p("/api/recruiting/hub/ticker?year=2027")}catch(e){}})();</script>';

function walkVaultHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVaultHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function firstScriptIndex(html) {
  return html.search(/<script[\s>]/i);
}

function patchHtml(html) {
  let next = html;

  if (!next.includes('data-gv-hydration-css')) {
    if (next.includes('</head>')) next = next.replace('</head>', `${CSS_TAG}</head>`);
    else next = CSS_TAG + next;
  }

  if (!next.includes('data-gv-hydration-boot')) {
    const scriptIdx = firstScriptIndex(next);
    if (scriptIdx >= 0) {
      next = next.slice(0, scriptIdx) + API_WARM_TAG + BOOT_TAG + next.slice(scriptIdx);
    } else if (next.includes('</body>')) {
      next = next.replace('</body>', `${API_WARM_TAG}${BOOT_TAG}</body>`);
    } else {
      next += API_WARM_TAG + BOOT_TAG;
    }
  } else if (!next.includes('data-gv-api-warm')) {
    next = next.replace(BOOT_TAG, API_WARM_TAG + BOOT_TAG);
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

module.exports = { injectVaultHydrationGuard };
