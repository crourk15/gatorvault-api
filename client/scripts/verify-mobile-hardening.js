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

mustInclude('lib/body-scroll-lock.ts', [
  'export function lockBodyScroll',
  'export function ensureDocumentScrollUnlocked',
  'gv-scroll-locked',
]);
mustInclude('components/community/CommunityReportModal.tsx', ['lockBodyScroll']);
mustInclude('components/community/CommunityConfirmModal.tsx', ['lockBodyScroll']);
mustInclude('components/shell/AppMenuDrawer.tsx', ['lockBodyScroll']);
mustInclude('components/team/TeamStaffDestinationPage.tsx', ['lockBodyScroll']);
mustInclude('components/vault/VaultCommunityPage.tsx', ['mobile-app', 'gv-community']);
mustInclude('lib/vault-shell.css', [
  'body.gv-scroll-locked',
  'min-height: 44px',
  '.gv-community__action-btn',
]);
mustInclude('lib/home-wow.css', [
  'overflow: visible',
  '.gv-vault-shell__main:has(.home-wow-page)',
]);
mustInclude('lib/gv-ui-cleanup.css', [
  'html:has(.home-wow-page)',
  'body:has(.home-wow-page):not(.gv-scroll-locked)',
  '.gv-vault-shell--home.is-navigating .gv-vault-shell__main',
  'overscroll-behavior-x: none',
  'min-height: auto !important',
  'body:has(.fc-profile-page--feed) .fc-profile-tabs',
  'position: static !important',
]);
mustInclude('lib/futurecast.css', [
  'overflow-y: hidden',
  '--gv-shell-header-height',
]);
mustInclude('hooks/usePlayerProfileRoute.ts', [
  'optimisticProfileState',
  'prefetchFullProfile',
]);
mustInclude('components/vault/VaultPlayerProfileRoute.tsx', [
  'ProfileSkeleton',
  'ensureDocumentScrollUnlocked',
]);
{
  const rel = 'components/vault/VaultPlayerProfileRoute.tsx';
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    const text = fs.readFileSync(abs, 'utf8');
    if (text.includes('Loading player profile')) {
      failures.push(`${rel}: must not show plain "Loading player profile…" status text`);
    }
  }
}
mustInclude('lib/vault-menu-boot.js', [
  'clearBodyLock',
  'applyBodyLock',
  'gv-scroll-locked',
]);
mustInclude('lib/mobile-native-framework.css', [
  '.gv-mobile-back-top',
  'var(--mobile-gutter, 16px)',
  'left: auto',
  'inset-inline-end:',
  'z-index: 60',
  'touch-action: manipulation',
]);
mustInclude('components/vault/MobileBackToTop.tsx', [
  'scrollingElement',
  'scrollDocumentToTop',
  'data-testid="mobile-back-to-top"',
  'onTouchEnd',
]);

// Cyclic custom props invalidate tokens app-wide (broke homepage back-to-top).
{
  const tokensRel = 'styles/recruiting-hub-tokens.css';
  const abs = path.join(ROOT, tokensRel);
  if (!fs.existsSync(abs)) {
    failures.push(`missing file: ${tokensRel}`);
  } else {
    const text = fs
      .readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const cyclic = text.match(/--(space-(?:md|lg|xl))\s*:\s*var\(\s*--\1\s*\)/g);
    if (cyclic && cyclic.length) {
      failures.push(`${tokensRel}: cyclic custom props ${cyclic.join(', ')}`);
    }
  }
}

// Home page must not set overflow-x alone (CSS coerces overflow-y → auto → nested scroll).
{
  const homeWowRel = 'lib/home-wow.css';
  const abs = path.join(ROOT, homeWowRel);
  if (fs.existsSync(abs)) {
    const text = fs
      .readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const pageBlock = text.match(/\.home-wow-page\s*\{[^}]+\}/);
    if (pageBlock && /overflow-x\s*:/.test(pageBlock[0]) && !/overflow\s*:/.test(pageBlock[0])) {
      failures.push(`${homeWowRel}: .home-wow-page sets overflow-x without overflow shorthand`);
    }
  }
}

// Body unlock must not use overflow-x:clip + overflow-y:visible (dual scrollport on iOS).
{
  const cleanupRel = 'lib/gv-ui-cleanup.css';
  const abs = path.join(ROOT, cleanupRel);
  if (fs.existsSync(abs)) {
    const text = fs.readFileSync(abs, 'utf8');
    const homeBody = text.match(
      /body:has\(\.home-wow-page\):not\(\.gv-scroll-locked\)[\s\S]{0,280}?\{[^}]+\}/
    );
    if (homeBody && /overflow-x\s*:\s*clip/.test(homeBody[0])) {
      failures.push(
        `${cleanupRel}: home body unlock must not set overflow-x:clip (coerces Y scrollport)`
      );
    }
  }
}

if (failures.length) {
  console.error('[verify-mobile-hardening] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}

console.log('[verify-mobile-hardening] OK');