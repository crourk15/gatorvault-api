#!/usr/bin/env node
const { chromium } = require('playwright');
const { seedProofAuth } = require('./proof-auth-bootstrap.js');
const BASE = 'http://127.0.0.1:8787';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PE:' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('CE:' + m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => logs.push('RF:' + r.url().slice(-80)));

  await seedProofAuth(page, BASE);
  await page.goto(BASE + '/vault/recruiting/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(15000);
  const info = await page.evaluate(() => ({
    url: location.href,
    bodyLen: document.body?.innerText?.length,
    root: !!document.getElementById('gv-vault-root'),
    rh: !!document.querySelector('[data-testid="vault-recruiting-hub"]'),
    html: document.body?.innerText?.slice(0, 300),
  }));
  console.log(JSON.stringify(info, null, 2));
  console.log('logs', logs.slice(0, 15));
  await browser.close();
})();
