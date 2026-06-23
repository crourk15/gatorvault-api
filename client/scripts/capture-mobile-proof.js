#!/usr/bin/env node
/** Capture mobile proof screenshots + /vault load recording for deploy approval. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.PROOF_BASE || 'http://127.0.0.1:8787';
const OUT = path.join(__dirname, '..', '..', 'proof', 'mobile-deploy-proof');

async function waitForBoot(page, ms = 8000) {
  await page.waitForTimeout(ms);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: OUT, size: { width: 375, height: 812 } },
  });

  const page = await context.newPage();

  // Screen recording: /vault/ cold load
  await page.goto(`${BASE}/vault/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForBoot(page, 12000);

  const buildId = await page
    .evaluate(() => {
      const meta = document.querySelector('meta[name="gatorvault-build"]');
      if (meta?.getAttribute('content')) return meta.getAttribute('content');
      const html = document.documentElement.innerHTML;
      const m = html.match(/gatorvault-build" content="([^"]+)"/);
      return m?.[1] ?? 'unknown';
    })
    .catch(() => 'unknown');

  fs.writeFileSync(path.join(OUT, 'build-id.txt'), `${buildId}\n`, 'utf8');

  await page.screenshot({ path: path.join(OUT, '01-vault-home-load.png'), fullPage: false });

  // Beat intel section (scroll into view)
  const beat = page.locator('[data-testid="home-beat-highlights"], [data-home-boot="beat-highlights"]').first();
  if (await beat.count()) {
    await beat.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '02-beat-intel.png'), fullPage: false });
  } else {
    await page.screenshot({ path: path.join(OUT, '02-beat-intel.png'), fullPage: false });
  }

  // Bottom nav close-up via recruiting page + menu test
  await page.goto(`${BASE}/vault/recruiting/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForBoot(page, 8000);
  await page.screenshot({ path: path.join(OUT, '03-recruiting-hub.png'), fullPage: false });

  const menuBtn = page.locator('[data-vault-menu-toggle]').first();
  await menuBtn.click();
  await page.waitForTimeout(500);
  const menuOpen = await page.locator('#gv-app-menu-drawer.is-open').count();
  await page.screenshot({ path: path.join(OUT, '04-bottom-nav-menu-open.png'), fullPage: false });
  fs.writeFileSync(
    path.join(OUT, 'menu-open.txt'),
    menuOpen > 0 ? 'menu drawer opened: yes\n' : 'menu drawer opened: no\n',
    'utf8'
  );
  if (menuOpen) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: path.join(OUT, '05-bottom-nav.png'), fullPage: false });

  await page.goto(`${BASE}/vault/team/`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(
    () => document.body?.innerText?.includes('Team Command Center'),
    { timeout: 45000 }
  ).catch(() => {});
  await page.waitForTimeout(2000);
  const warming = await page.locator('text=Waking up GatorVault').count();
  fs.writeFileSync(
    path.join(OUT, 'team-warming.txt'),
    warming > 0 ? 'warming gate visible: yes\n' : 'warming gate visible: no\n',
    'utf8'
  );
  await page.screenshot({ path: path.join(OUT, '06-team-hub.png'), fullPage: false });

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();

  const videos = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
  if (videos.length) {
    const src = path.join(OUT, videos[0]);
    const dest = path.join(OUT, 'vault-load-recording.webm');
    if (src !== dest) fs.renameSync(src, dest);
  }

  console.log(`[capture-mobile-proof] saved to ${OUT}`);
  console.log(`[capture-mobile-proof] buildId=${buildId}`);
}

main().catch((err) => {
  console.error('[capture-mobile-proof] failed:', err);
  process.exit(1);
});
