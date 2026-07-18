'use strict';

/**
 * Guardrail: vault chrome / error recovery must not deep-link to marketing `/`.
 * Sign-out → /join is allowed; marketing landing is not.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function mustInclude(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${rel}: expected to include ${JSON.stringify(needle)}`);
    }
  }
}

function mustNotMatch(rel, patterns) {
  const text = read(rel);
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      failures.push(`${rel}: forbidden pattern ${pattern}`);
    }
  }
}

mustInclude('components/site/UiMessage.tsx', ["backHref = '/vault/'", "safeBackHref"]);
mustInclude('components/vault/VaultErrorBoundary.tsx', ['dashboardHref="/vault/"']);
mustInclude('components/vault/VaultShell.tsx', ['href="/vault/"', 'forceVaultRoutes']);
mustInclude('components/vault/VaultNavLink.tsx', ["'/vault/'"]);
mustInclude('components/shell/AppMenuDrawer.tsx', ['forceVaultRoutes']);
mustInclude('components/errors/RouteErrorFallback.tsx', ["dashboardHref = '/vault/'"]);

mustNotMatch('components/vault/VaultErrorBoundary.tsx', [/homeHref\s*=\s*["']\/["']/]);
mustNotMatch('components/vault/VaultShell.tsx', [/href=\{inVault \? ['"]\/vault\/['"] : ['"]\/['"]\}/]);
mustNotMatch('components/site/UiMessage.tsx', [/backHref\s*=\s*['"]\/['"]/]);

const fcFiles = [
  'components/futurecast/MasterBoardLayout.tsx',
  'components/futurecast/TrendingBoardPageContent.tsx',
  'components/futurecast/MovementIntelPageContent.tsx',
  'components/futurecast/StaffNotesPageContent.tsx',
];
for (const rel of fcFiles) {
  mustInclude(rel, ['backHref="/vault/futurecast"']);
}

if (failures.length) {
  console.error('[verify-vault-no-landing-bounce] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}

console.log('[verify-vault-no-landing-bounce] OK');
