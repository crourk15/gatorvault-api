const { chromium } = require('playwright');
const { seedProofAuth } = require('./proof-auth-bootstrap.js');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await seedProofAuth(page, 'http://127.0.0.1:8787');
  await page.goto('http://127.0.0.1:8787/vault/futurecast/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(20000);
  const sels = [
    'fc-lab-page-mobile', 'futurecast-home', 'fc-page-layout', 'vault-futurecast-page',
    'fc-elite-loading', 'fc-lab-hero',
  ];
  for (const s of sels) {
    const c = await page.locator(`[data-testid="${s}"]`).count();
    const t = c ? await page.locator(`[data-testid="${s}"]`).first().innerText() : '';
    console.log(s, c, t.slice(0, 80));
  }
  console.log('body', (await page.evaluate(() => document.body.innerText)).slice(0, 200));
  await browser.close();
})();
