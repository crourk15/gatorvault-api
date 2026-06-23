#!/usr/bin/env node
/** Inject pre-React menu toggle on all vault static HTML exports. */
const fs = require('fs');
const path = require('path');
const { VAULT_MENU_BOOT_SCRIPT } = require('../lib/vault-menu-boot.js');

const serverDir = path.join(__dirname, '..', '..', 'server');
const vaultDir = path.join(serverDir, 'vault');
const BOOT_TAG = `<script data-gv-menu-boot="">${VAULT_MENU_BOOT_SCRIPT}</script>`;

function walkVaultHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVaultHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function patchMenuButton(html) {
  if (html.includes('data-vault-menu-toggle')) return html;
  return html.replace(
    /<button(\s[^>]*aria-controls="gv-app-menu-drawer"[^>]*)>/,
    '<button$1 data-vault-menu-toggle="">'
  );
}

function patchHtml(html) {
  let next = html;
  next = patchMenuButton(next);
  if (next.includes('data-gv-menu-boot')) {
    next = next.replace(/<script data-gv-menu-boot="">[\s\S]*?<\/script>/gi, BOOT_TAG);
    return next;
  }
  if (next.includes('data-gv-hydration-boot')) {
    return next.replace(
      /<script data-gv-hydration-boot="">/,
      `${BOOT_TAG}<script data-gv-hydration-boot="">`
    );
  }
  if (next.includes('</body>')) return next.replace('</body>', `${BOOT_TAG}</body>`);
  return next + BOOT_TAG;
}

const files = walkVaultHtml(vaultDir);
let updated = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = patchHtml(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    updated += 1;
  }
}
console.log(`[inject-vault-menu-boot] patched ${updated}/${files.length} vault HTML exports`);
