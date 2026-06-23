#!/usr/bin/env node
/**
 * Full mobile app verification — JS enabled, every vault route + section.
 * Exit 1 on any failure. Run via: npm run verify:mobile:full
 *
 * Requires: local static server (serve-local-netlify.js) + warm Render API.
 */
const {
  ALL_ROUTES,
  ROUTE_CHECKS,
  GLOBAL_FORBIDDEN,
} = require('../lib/full-mobile-verify-matrix.cjs');
const { seedProofAuth } = require('./proof-auth-bootstrap.js');

const BASE = process.env.VERIFY_BASE || 'http://127.0.0.1:8787';
const SETTLE_MS = Number(process.env.VERIFY_SETTLE_MS || 90_000);
const POLL_MS = Number(process.env.VERIFY_POLL_MS || 2_000);
const BLANK_FAIL_MS = Number(process.env.VERIFY_BLANK_FAIL_MS || 20_000);
const PASS_LABEL = process.env.VERIFY_PASS || '1';

async function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('[verify-full-mobile] playwright not installed — run: npm install --save-dev playwright && npx playwright install chromium');
    process.exit(1);
  }
}

async function assertSection(page, spec) {
  const loc = page.locator(spec.sel);
  const matchCount = await loc.count();
  if (!matchCount) {
    return { ok: false, reason: `${spec.label}: selector not found (${spec.sel})` };
  }

  for (let i = 0; i < matchCount; i++) {
    const item = loc.nth(i);
    await item.scrollIntoViewIfNeeded({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(300);

    const state = await item.evaluate((node, noSkeleton) => {
      const text = (node.innerText || '').trim();
      const skeletonOnly =
        noSkeleton &&
        (node.matches('.rh-skeleton') ||
          (node.querySelector('.rh-skeleton[aria-hidden="true"]') && text.length < 40) ||
          (node.getAttribute('aria-busy') === 'true' && text.length < 40));
      const hidden =
        node.hidden ||
        node.getAttribute('aria-hidden') === 'true' ||
        node.classList.contains('gv-vault-ssr-marker');
      return { textLen: text.length, skeletonOnly, hidden };
    }, Boolean(spec.noSkeleton));

    if (state.hidden && state.textLen < (spec.minText || 15)) continue;
    if (state.skeletonOnly) continue;
    if (state.textLen < (spec.minText || 15)) continue;
    return { ok: true };
  }

  const first = loc.first();
  const textLen = await first.evaluate((node) => (node.innerText || '').trim().length).catch(() => 0);
  return { ok: false, reason: `${spec.label}: insufficient content (${textLen} chars)` };
}

async function waitForRouteReady(page, routeId, checks) {
  const deadline = Date.now() + SETTLE_MS;
  const blankDeadline = Date.now() + BLANK_FAIL_MS;
  let lastReason = 'timeout';

  while (Date.now() < deadline) {
    const bodyText = await page.evaluate(() => (document.body?.innerText || '').trim()).catch(() => '');
    if (bodyText.length === 0 && Date.now() > blankDeadline) {
      return { ok: false, reason: 'blank page after hydration (0 body text)' };
    }
    const forbiddenHit = GLOBAL_FORBIDDEN.find((t) => bodyText.includes(t));
    if (forbiddenHit) {
      lastReason = `forbidden text: ${forbiddenHit}`;
      await page.waitForTimeout(POLL_MS);
      continue;
    }

    const routeForbidden = checks.forbidden || [];
    let routeBlock = null;
    for (const f of routeForbidden) {
      if (f.startsWith('[')) {
        if (await page.locator(f).count()) {
          routeBlock = f;
          break;
        }
      } else if (bodyText.includes(f)) {
        routeBlock = f;
        break;
      }
    }
    if (routeBlock) {
      lastReason = `route forbidden: ${routeBlock}`;
      await page.waitForTimeout(POLL_MS);
      continue;
    }

    if (bodyText.length < (checks.minBodyText || 100)) {
      lastReason = `body too short (${bodyText.length} chars)`;
      await page.waitForTimeout(POLL_MS);
      continue;
    }

    const rootCount = await page.locator(checks.root).count();
    if (!rootCount) {
      lastReason = `root missing (${checks.root})`;
      await page.waitForTimeout(POLL_MS);
      continue;
    }

    const sectionFails = [];
    for (const section of checks.sections || []) {
      const result = await assertSection(page, section);
      if (!result.ok) sectionFails.push(result.reason);
    }

    if (sectionFails.length === 0) {
      return { ok: true };
    }
    lastReason = sectionFails.join('; ');
    await page.waitForTimeout(POLL_MS);
  }

  return { ok: false, reason: lastReason };
}

async function testMenuToggle(page, routeLabel) {
  const btn = page.locator('[data-vault-menu-toggle]').first();
  if (!(await btn.count())) {
    return { ok: false, reason: 'menu toggle missing' };
  }
  await btn.click();
  await page.waitForTimeout(400);
  const open = await page.locator('#gv-app-menu-drawer.is-open').count();
  if (!open) {
    return { ok: false, reason: 'menu drawer did not open' };
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return { ok: true };
}

async function verifyRoute(page, route) {
  const checks = ROUTE_CHECKS[route.id];
  if (!checks) {
    return { route: route.label, ok: false, reason: `no checks defined for id=${route.id}` };
  }

  const url = `${BASE}${route.path}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (checks.redirect) {
      await page.waitForURL(`**${checks.redirect}**`, { timeout: 30_000 }).catch(() => {});
    }
  } catch (err) {
    return { route: route.label, ok: false, reason: `navigation failed: ${err.message}` };
  }

  const ready = await waitForRouteReady(page, route.id, checks);
  if (!ready.ok) {
    return { route: route.label, path: route.path, ok: false, reason: ready.reason };
  }

  if (checks.testMenu) {
    const menu = await testMenuToggle(page, route.label);
    if (!menu.ok) {
      return { route: route.label, path: route.path, ok: false, reason: `menu: ${menu.reason}` };
    }
  }

  return { route: route.label, path: route.path, ok: true };
}

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log(`[verify-full-mobile] pass ${PASS_LABEL} — seeding auth…`);
  await seedProofAuth(page, BASE);

  console.log(`[verify-full-mobile] pass ${PASS_LABEL} — base=${BASE} settle=${SETTLE_MS}ms routes=${ALL_ROUTES.length}`);

  const failures = [];
  for (const route of ALL_ROUTES) {
    process.stdout.write(`  · ${route.label} (${route.path}) … `);
    const result = await verifyRoute(page, route);
    if (result.ok) {
      console.log('ok');
    } else {
      console.log('FAIL');
      console.error(`    ↳ ${result.reason}`);
      failures.push(result);
    }
  }

  await context.close();
  await browser.close();

  if (failures.length) {
    console.error(`\n[verify-full-mobile] FAILED — ${failures.length}/${ALL_ROUTES.length} routes`);
    for (const f of failures) {
      console.error(`  ✗ ${f.route} (${f.path || '?'}): ${f.reason}`);
    }
    process.exit(1);
  }

  console.log(`\n[verify-full-mobile] PASSED — all ${ALL_ROUTES.length} routes + sections (pass ${PASS_LABEL})`);
}

main().catch((err) => {
  console.error('[verify-full-mobile] fatal:', err);
  process.exit(1);
});
