'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];

function mustInclude(fileRel, needles) {
  const abs = path.join(ROOT, fileRel);
  if (!fs.existsSync(abs)) {
    failures.push(`missing file: ${fileRel}`);
    return;
  }
  const text = fs.readFileSync(abs, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${fileRel}: expected to include ${JSON.stringify(needle)}`);
    }
  }
}

mustInclude('lib/body-scroll-lock.ts', ['export function lockBodyScroll', 'gv-scroll-locked']);
mustInclude('components/community/CommunityReportModal.tsx', ['lockBodyScroll']);
mustInclude('components/community/CommunityConfirmModal.tsx', ['lockBodyScroll']);
mustInclude('components/shell/AppMenuDrawer.tsx', ['lockBodyScroll']);
mustInclude('components/team/TeamHubPage.tsx', ['lockBodyScroll']);
mustInclude('components/vault/VaultCommunityPage.tsx', ['mobile-app', 'gv-community']);
mustInclude('lib/vault-shell.css', [
  'body.gv-scroll-locked',
  'min-height: 44px',
  '.gv-community__action-btn',
]);

if (failures.length) {
  console.error('[verify-mobile-hardening] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}

console.log('[verify-mobile-hardening] OK');