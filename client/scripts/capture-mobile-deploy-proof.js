#!/usr/bin/env node
/**
 * Capture full mobile deploy proof package:
 *   - Screenshot every required route (375×812, JS enabled)
 *   - Menu open + close on each route
 *   - Screen recordings for /vault/, /vault/recruiting/, /vault/team/ cold load
 *   - Section checklist (pass/fail)
 *   - Local build ID + git commit metadata
 *
 * Output: proof/mobile-deploy-proof/
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  PROOF_ROUTES,
  RECORDING_ROUTES,
  SECTION_CHECKLIST,
  LAYOUT_NAV_CHECKS,
  GLOBAL_FORBIDDEN,
} = require('../lib/mobile-deploy-proof-matrix.cjs');
const { seedProofAuth } = require('./proof-auth-bootstrap.js');

const BASE = process.env.PROOF_BASE || 'http://127.0.0.1:8787';
const OUT = path.resolve(__dirname, '..', '..', 'proof', 'mobile-deploy-proof');
const SETTLE_MS = Number(process.env.PROOF_SETTLE_MS || 45_000);
const VIEWPORT = { width: 375, height: 812 };

const dirs = {
  root: OUT,
  routes: path.join(OUT, 'screenshots', 'routes'),
  menu: path.join(OUT, 'screenshots', 'menu'),
  sections: path.join(OUT, 'screenshots', 'sections'),
  recordings: path.join(OUT, 'recordings'),
  build: path.join(OUT, 'build'),
};

function ensureDirs() {
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('[proof] playwright required — npm install --save-dev playwright && npx playwright install chromium');
    process.exit(1);
  }
}

function gitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.env.COMMIT_REF || 'unknown';
  }
}

function readLocalBuildManifest() {
  const manifestPath = path.join(__dirname, '..', '..', 'server', 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

async function readBuildId(page) {
  return page
    .evaluate(() => {
      const meta = document.querySelector('meta[name="gatorvault-build"]');
      if (meta?.getAttribute('content')) return meta.getAttribute('content');
      const m = document.documentElement.innerHTML.match(/gatorvault-build" content="([^"]+)"/);
      return m?.[1] ?? null;
    })
    .catch(() => null);
}

async function settlePage(page, ms = SETTLE_MS) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const bodyLen = await page
      .evaluate(() => (document.body?.innerText || '').trim().length)
      .catch(() => 0);
    if (bodyLen > 100) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
}

async function evaluateSection(page, check, opts = {}) {
  const deadline = Date.now() + (check.waitForbiddenMs || SETTLE_MS);
  if (check.path && !opts.skipGoto) {
    await page.goto(`${BASE}${check.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } else if (check.path && opts.skipGoto) {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(400);
  }

  while (Date.now() < deadline) {
    await settlePage(page, Math.min(5000, deadline - Date.now()));

    const loc = page.locator(check.selector);
    const matchCount = await loc.count();
    for (let i = 0; i < matchCount; i++) {
      const item = loc.nth(i);
      await item.scrollIntoViewIfNeeded({ timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(300);

      const state = await item.evaluate(
        (node, noSkeleton) => {
          const text = (node.innerText || '').trim();
          const skeletonOnly =
            noSkeleton &&
            (node.matches('.rh-skeleton') ||
              (node.querySelector('.rh-skeleton[aria-hidden="true"]') && text.length < 40));
          return { textLen: text.length, skeletonOnly, hidden: node.hidden || node.getAttribute('aria-hidden') === 'true' };
        },
        Boolean(check.noSkeleton)
      );

      if (state.hidden && state.textLen < (check.minText || 15)) continue;

      if (!state.skeletonOnly && state.textLen >= (check.minText || 15)) {
        const forbidden = check.forbidden || [];
        const text = await item.innerText().catch(() => '');
        if (forbidden.some((f) => text.includes(f))) continue;
        return { pass: true, reason: `${state.textLen} chars` };
      }
    }

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hardFail = bodyText.includes('Minified React error #423') || bodyText.length < 50;
    if (hardFail) {
      await page.waitForTimeout(1500);
      continue;
    }

    await page.waitForTimeout(1500);
  }

  return { pass: false, reason: 'timeout waiting for section content' };
}

async function measurePageOverflow(page) {
  return page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
    viewport: window.innerWidth,
  }));
}

async function runLayoutNavCheck(page, check) {
  await page.goto(`${BASE}${check.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settlePage(page, Math.min(SETTLE_MS, 30_000));

  if (check.id.endsWith('-no-overflow')) {
    const { scrollWidth, viewport } = await measurePageOverflow(page);
    const pass = scrollWidth <= viewport + 2;
    return {
      pass,
      reason: pass
        ? `body ${scrollWidth}px ≤ viewport ${viewport}px`
        : `horizontal overflow ${scrollWidth}px > ${viewport}px`,
    };
  }

  if (check.id === 'nil-table-scroll') {
    const wrap = page.locator('.nil-rank-table-wrap').first();
    // NIL dashboard is API-backed — wait through cold Render wake before failing.
    try {
      await wrap.waitFor({ state: 'attached', timeout: 90_000 });
    } catch {
      return { pass: false, reason: 'rankings table wrapper missing' };
    }
    const metrics = await wrap.evaluate((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
    }));
    const pageMetrics = await measurePageOverflow(page);
    const tableScrolls = metrics.scroll > metrics.client + 4;
    const pageOk = pageMetrics.scrollWidth <= pageMetrics.viewport + 2;
    return {
      pass: tableScrolls && pageOk,
      reason: tableScrolls
        ? `table scroll ${metrics.scroll}/${metrics.client}px, page ${pageMetrics.scrollWidth}px`
        : `table not scroll-contained (${metrics.scroll}/${metrics.client}px)`,
    };
  }

  if (check.id === 'nil-home-vault') {
    // Prefer explicit Home href — not first a[href*="/vault"] (all bottom items match).
    const home = page
      .locator('.gv-vault-bottom-nav a[href="/vault/"], .gv-vault-bottom-nav a[href="/vault"]')
      .first();
    if (!(await home.count())) {
      return { pass: false, reason: 'vault home nav link missing' };
    }
    const normalizePath = (pathname) => {
      let p = String(pathname || '/');
      p = p.replace(/\/index\.html$/i, '/');
      p = p.replace(/\/$/, '') || '/';
      return p;
    };
    await Promise.all([
      page
        .waitForURL((url) => normalizePath(url.pathname) === '/vault', { timeout: 15_000 })
        .catch(() => null),
      home.click(),
    ]);
    await page.waitForTimeout(500);
    const pathAfter = await page.evaluate(() => {
      let p = window.location.pathname || '/';
      p = p.replace(/\/index\.html$/i, '/');
      return p.replace(/\/$/, '') || '/';
    });
    const pass = pathAfter === '/vault';
    return {
      pass,
      reason: pass ? 'landed on /vault/' : `landed on ${pathAfter} (expected /vault)`,
    };
  }

  if (check.id.endsWith('-menu-stress')) {
    const toggle = page.locator('[data-vault-menu-toggle]').first();
    if (!(await toggle.count())) {
      return { pass: false, reason: 'menu toggle missing' };
    }
    for (let i = 0; i < 3; i += 1) {
      await toggle.click();
      await page.waitForTimeout(450);
      const open = (await page.locator('#gv-app-menu-drawer.is-open').count()) > 0;
      if (!open) {
        return { pass: false, reason: `open failed on attempt ${i + 1}` };
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      const closed = (await page.locator('#gv-app-menu-drawer.is-open').count()) === 0;
      if (!closed) {
        return { pass: false, reason: `close failed on attempt ${i + 1}` };
      }
    }
    return { pass: true, reason: '3× open/close ok' };
  }

  return { pass: false, reason: 'unknown check' };
}

async function waitForMenuReady(page) {
  await page
    .waitForFunction(
      () => {
        const btn = document.querySelector('[data-vault-menu-toggle]');
        if (!btn) return false;
        return Boolean(window.__GV_MENU_BOOT__) || btn.hasAttribute('data-vault-menu-react');
      },
      { timeout: 30_000 },
    )
    .catch(() => {});
}

async function testMenu(page, route) {
  const toggle = page.locator('[data-vault-menu-toggle]').first();
  if (!(await toggle.count())) {
    return { open: false, close: false, reason: 'menu toggle missing' };
  }

  await waitForMenuReady(page);

  let open = false;
  for (let attempt = 0; attempt < 2 && !open; attempt += 1) {
    if (attempt > 0) await page.waitForTimeout(1500);
    await toggle.click();
    await page.waitForTimeout(500);
    open = (await page.locator('#gv-app-menu-drawer.is-open').count()) > 0;
  }
  await page.screenshot({ path: path.join(dirs.menu, `${route.slug}-menu-open.png`) });

  if (open) {
    const headClose = page.locator('.gv-app-menu__close').first();
    if (await headClose.count()) {
      await headClose.click({ force: true });
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
  }

  const closed = (await page.locator('#gv-app-menu-drawer.is-open').count()) === 0;
  await page.screenshot({ path: path.join(dirs.menu, `${route.slug}-menu-closed.png`) });

  return {
    open,
    close: closed,
    pass: open && closed,
    reason: open ? (closed ? 'open + close ok' : 'did not close') : 'drawer did not open',
  };
}

async function captureRoute(page, route) {
  let url = `${BASE}${route.path}`;
  let response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => null);

  if ((!response || response.status() >= 400) && route.fallback) {
    url = `${BASE}${route.fallback}`;
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => null);
  }

  await settlePage(page);
  await page.screenshot({ path: path.join(dirs.routes, `${route.slug}.png`), fullPage: false });

  const bodyLen = await page.evaluate(() => (document.body?.innerText || '').trim().length);
  const menu = await testMenu(page, route);

  return {
    slug: route.slug,
    path: route.path,
    label: route.label,
    bodyTextLength: bodyLen,
    screenshot: `screenshots/routes/${route.slug}.png`,
    menu,
  };
}

async function recordLoad(chromium, route) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: dirs.recordings, size: VIEWPORT },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(route.durationMs);
  await context.close();
  await browser.close();

  const videos = fs.readdirSync(dirs.recordings).filter((f) => f.endsWith('.webm'));
  const latest = videos.sort().pop();
  if (latest) {
    const dest = path.join(dirs.recordings, `${route.slug}.webm`);
    fs.renameSync(path.join(dirs.recordings, latest), dest);
    return dest;
  }
  return null;
}

function writeChecklistMarkdown(results, menuResults) {
  const lines = [
    '# Mobile Deploy Proof Checklist',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE}`,
    '',
    '## Sections',
    '',
    '| Section | Result | Notes |',
    '|---------|--------|-------|',
  ];

  for (const row of results) {
    lines.push(`| ${row.label} | **${row.pass ? 'PASS' : 'FAIL'}** | ${row.reason} |`);
  }

  const belowNsd = results.filter((r) => r.group === 'below-nsd');
  const belowPass = belowNsd.length > 0 && belowNsd.every((r) => r.pass);
  lines.push(`| Everything below NSD (rollup) | **${belowPass ? 'PASS' : 'FAIL'}** | ${belowNsd.filter((r) => !r.pass).map((r) => r.label).join(', ') || 'all sub-checks pass'} |`);

  lines.push('', '## Menu open/close per route', '', '| Route | Open | Close | Result |', '|-------|------|-------|--------|');
  for (const m of menuResults) {
    lines.push(`| ${m.label} | ${m.menu.open ? 'yes' : 'no'} | ${m.menu.close ? 'yes' : 'no'} | **${m.menu.pass ? 'PASS' : 'FAIL'}** |`);
  }

  fs.writeFileSync(path.join(OUT, 'CHECKLIST.md'), lines.join('\n'), 'utf8');
}

async function main() {
  ensureDirs();
  const { chromium } = loadPlaywright();

  const manifest = readLocalBuildManifest();
  const commit = gitCommit();
  fs.writeFileSync(path.join(dirs.build, 'git-commit.txt'), `${commit}\n`, 'utf8');
  if (manifest) {
    fs.writeFileSync(path.join(dirs.build, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(dirs.build, 'local-build-id.txt'), `${manifest.buildId}\n`, 'utf8');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('[proof] seeding auth session for gated vault routes…');
  await seedProofAuth(page, BASE);

  console.log('[proof] capturing route screenshots + menu tests…');
  const menuResults = [];
  for (const route of PROOF_ROUTES) {
    process.stdout.write(`  · ${route.label} … `);
    const result = await captureRoute(page, route);
    menuResults.push({ label: route.label, slug: route.slug, menu: result.menu });
    console.log(result.menu.pass ? 'ok' : `menu FAIL (${result.menu.reason})`);
  }

  const buildId = (await readBuildId(page)) || manifest?.buildId || 'unknown';
  fs.writeFileSync(path.join(dirs.build, 'observed-build-id.txt'), `${buildId}\n`, 'utf8');

  console.log('[proof] evaluating section checklist…');
  const checklistResults = [];
  let lastCheckPath = null;
  for (const check of SECTION_CHECKLIST) {
    process.stdout.write(`  · ${check.label} … `);
    const skipGoto = Boolean(check.path && check.path === lastCheckPath);
    const result = await evaluateSection(page, check, { skipGoto });
    if (check.path) lastCheckPath = check.path;
    const row = {
      id: check.id,
      label: check.label,
      group: check.group || null,
      pass: result.pass,
      reason: result.reason,
      path: check.path,
      selector: check.selector,
    };
    checklistResults.push(row);
    console.log(row.pass ? 'PASS' : `FAIL (${row.reason})`);

    if (row.pass) {
      const shot = path.join(dirs.sections, `${check.id}.png`);
      await page.locator(check.selector).first().screenshot({ path: shot }).catch(() => {});
    }
  }

  console.log('[proof] evaluating layout + nav integrity…');
  const layoutNavResults = [];
  for (const check of LAYOUT_NAV_CHECKS) {
    process.stdout.write(`  · ${check.label} … `);
    const result = await runLayoutNavCheck(page, check);
    const row = {
      id: check.id,
      label: check.label,
      group: 'layout-nav',
      pass: result.pass,
      reason: result.reason,
      path: check.path,
    };
    layoutNavResults.push(row);
    console.log(row.pass ? 'PASS' : `FAIL (${row.reason})`);
  }

  const allChecklistResults = [...checklistResults, ...layoutNavResults];

  await context.close();
  await browser.close();

  console.log('[proof] recording cold loads…');
  const recordings = [];
  for (const rec of RECORDING_ROUTES) {
    process.stdout.write(`  · ${rec.label} … `);
    const file = await recordLoad(chromium, rec);
    recordings.push({ slug: rec.slug, path: rec.path, file: file ? path.relative(OUT, file) : null });
    console.log(file ? 'saved' : 'missing');
  }

  const belowNsd = allChecklistResults.filter((r) => r.group === 'below-nsd');
  const layoutNav = allChecklistResults.filter((r) => r.group === 'layout-nav');
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    buildId,
    gitCommit: commit,
    localManifest: manifest,
    routes: PROOF_ROUTES.map((r) => r.path),
    recordings: recordings.map((r) => r.file).filter(Boolean),
    checklist: allChecklistResults,
    belowNsdRollup: {
      pass: belowNsd.every((r) => r.pass),
      failed: belowNsd.filter((r) => !r.pass).map((r) => r.id),
    },
    layoutNavRollup: {
      pass: layoutNav.every((r) => r.pass),
      failed: layoutNav.filter((r) => !r.pass).map((r) => r.id),
    },
    menu: menuResults.map((m) => ({ slug: m.slug, label: m.label, ...m.menu })),
    allPass:
      allChecklistResults.every((r) => r.pass) &&
      belowNsd.every((r) => r.pass) &&
      layoutNav.every((r) => r.pass) &&
      menuResults.every((m) => m.menu.pass),
  };

  fs.writeFileSync(path.join(OUT, 'checklist.json'), JSON.stringify(summary, null, 2));
  writeChecklistMarkdown(allChecklistResults, menuResults);

  fs.writeFileSync(
    path.join(OUT, 'README.md'),
    [
      '# Mobile Deploy Proof Package',
      '',
      `**Generated:** ${summary.generatedAt}`,
      `**Build ID:** ${buildId}`,
      `**Git commit:** ${commit}`,
      `**Overall:** ${summary.allPass ? 'PASS — ready for deploy review' : 'FAIL — do not deploy'}`,
      '',
      '## Contents',
      '',
      '- `CHECKLIST.md` — human-readable pass/fail table',
      '- `checklist.json` — machine-readable results',
      '- `screenshots/routes/` — every required route',
      '- `screenshots/menu/` — menu open + close per route',
      '- `screenshots/sections/` — section evidence (passing checks only)',
      '- `recordings/` — cold-load videos for Home, Recruiting, Team',
      '- `build/` — local build ID + manifest',
      '',
      '## Required before push/deploy',
      '',
      '1. All checklist rows PASS (including “Everything below NSD” + layout/nav)',
      '2. Menu open/close PASS on every route',
      '3. `npm run verify:netlify:build` — Netlify succeeded + production build ID matches commit',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log(`\n[proof] package written to ${OUT}`);
  console.log(`[proof] buildId=${buildId} overall=${summary.allPass ? 'PASS' : 'FAIL'}`);

  if (!summary.allPass && process.env.PROOF_ALLOW_FAIL !== '1') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[proof] fatal:', err);
  process.exit(1);
});
