const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'proof', 'mobile-deploy-proof');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('pageerror:', err.message));

  await page.goto('http://127.0.0.1:8787/vault/team/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => ({
    title: document.title,
    textLen: document.body?.innerText?.length ?? 0,
    snippet: document.body?.innerText?.slice(0, 300) ?? '',
    hasRoot: !!document.getElementById('gv-vault-root'),
    scripts: document.querySelectorAll('script[src]').length,
  }));
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(OUT, '06-team-hub.png'), fullPage: false });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
