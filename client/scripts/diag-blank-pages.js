#!/usr/bin/env node
const { chromium } = require('playwright');

const BASE = process.env.PROOF_BASE || 'http://127.0.0.1:8787';
const PATHS = ['/vault/team/', '/vault/futurecast/', '/vault/schedule/', '/vault/recruiting/'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const allErrors = [];

  page.on('pageerror', (e) => allErrors.push({ type: 'pageerror', msg: e.message }));
  page.on('console', (m) => {
    if (m.type() === 'error') allErrors.push({ type: 'console', msg: m.text() });
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('_next') || r.url().includes('vault-chunks')) {
      allErrors.push({ type: 'reqfail', msg: r.url() + ' ' + (r.failure()?.errorText || '') });
    }
  });

  for (const p of PATHS) {
    allErrors.length = 0;
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const info = await page.evaluate(() => ({
      bodyLen: (document.body?.innerText || '').trim().length,
      root: Boolean(document.getElementById('gv-vault-root')),
      menu: Boolean(document.querySelector('[data-vault-menu-toggle]')),
      vaultTeam: Boolean(document.querySelector('[data-testid="vault-team"]')),
      recruiting: Boolean(document.querySelector('[data-testid="vault-recruiting-hub"]')),
      scripts: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter(Boolean).slice(0, 8),
    }));
    console.log('\n===', p, '===');
    console.log(JSON.stringify(info, null, 2));
    console.log('errors:', allErrors.slice(0, 8));
  }
  await browser.close();
})();
