#!/usr/bin/env node
/**
 * Capture App Store Connect screenshots (6.5" / iPhone 14 Plus -> 1284x2778).
 *
 * Usage:
 *   APP_REVIEW_PASSWORD=... node scripts/capture-app-store-screenshots.js
 */
const fs = require('fs');
const path = require('path');

const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
const SITE = process.env.GV_SITE || 'https://gatorvaultinsider.com';
const EMAIL = (process.env.APP_REVIEW_EMAIL || 'appreview@gatorvaultinsider.com').trim().toLowerCase();
const PASSWORD = process.env.APP_REVIEW_PASSWORD || '';
const OUT = path.resolve(__dirname, '..', 'docs', 'app-store-screenshots');
const SETTLE_MS = Number(process.env.SCREENSHOT_SETTLE_MS || 35_000);

const SHOTS = [
  { file: '01-futurecast.png', path: '/vault/futurecast/' },
  { file: '02-recruiting.png', path: '/vault/recruiting/' },
  { file: '03-team.png', path: '/vault/team/' },
  { file: '04-community.png', path: '/vault/community/' },
  { file: '05-membership.png', path: '/vault/membership/' },
  { file: '06-live-feed.png', path: '/vault/live-feed/' },
];

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('Install playwright: npm install && npx playwright install chromium');
    process.exit(1);
  }
}

async function loginSession() {
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.session?.token) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.session;
}

async function seedSession(page, session) {
  await page.goto(`${SITE}/vault/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(
    (s) => {
      localStorage.setItem('gv_session', JSON.stringify(s));
      sessionStorage.removeItem('gv_auth_handoff');
    },
    session
  );
}

async function settle(page) {
  const deadline = Date.now() + SETTLE_MS;
  while (Date.now() < deadline) {
    const bodyLen = await page.evaluate(() => (document.body?.innerText || '').trim().length).catch(() => 0);
    const warming = await page.locator('.rh-skeleton, [aria-busy="true"]').count().catch(() => 0);
    if (bodyLen > 200 && warming === 0) break;
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function captureShot(page, shot) {
  await page.goto(`${SITE}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await settle(page);
  const outPath = path.join(OUT, shot.file);
  await page.screenshot({ path: outPath, fullPage: false, type: 'png' });
  return outPath;
}

async function main() {
  if (!PASSWORD) {
    console.error('Set APP_REVIEW_PASSWORD (demo account password).');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const { chromium, devices } = loadPlaywright();
  const device = devices['iPhone 14 Plus'];
  if (!device) {
    console.error('Playwright missing iPhone 14 Plus device profile.');
    process.exit(1);
  }
  // Playwright's profile uses 746px logical height (browser chrome). App Store 6.5" needs 926 -> 1284x2778.
  const appStoreContext = {
    ...device,
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
  };

  console.log('[screenshots] logging in as', EMAIL);
  const session = await loginSession();
  console.log('[screenshots] tier:', session.tier || 'unknown');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(appStoreContext);
  const page = await context.newPage();

  await seedSession(page, session);

  const results = [];
  for (const shot of SHOTS) {
    process.stdout.write(`[screenshots] ${shot.file} ... `);
    try {
      const outPath = await captureShot(page, shot);
      results.push({ file: shot.file, ok: true, path: outPath });
      console.log('ok');
    } catch (err) {
      results.push({ file: shot.file, ok: false, error: String(err.message || err) });
      console.log('FAIL', err.message || err);
    }
  }

  await context.close();
  await browser.close();

  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        site: SITE,
        device: 'iPhone 14 Plus (1284x2778)',
        email: EMAIL,
        results,
      },
      null,
      2
    )
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error('[screenshots] failed:', failed.map((f) => f.file).join(', '));
    process.exit(1);
  }
  console.log('[screenshots] saved to', OUT);
}

main().catch((err) => {
  console.error('[screenshots] fatal:', err);
  process.exit(1);
});
