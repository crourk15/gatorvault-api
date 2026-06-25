#!/usr/bin/env node
const { chromium } = require('playwright');
const { seedProofAuth } = require('./proof-auth-bootstrap.js');
const BASE = process.env.PROOF_BASE || 'http://127.0.0.1:8787';
const PATHS = ['/vault/', '/vault/recruiting/', '/vault/team/', '/vault/futurecast/', '/vault/schedule/', '/vault/live/'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await seedProofAuth(page, BASE);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));

  for (const p of PATHS) {
    errors.length = 0;
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(12000);
    const info = await page.evaluate(() => ({
      bodyLen: (document.body?.innerText || '').trim().length,
      root: !!document.getElementById('gv-vault-root'),
      menu: !!document.querySelector('[data-vault-menu-toggle]'),
    }));
    console.log(p, info, errors.slice(0, 2));
  }
  await browser.close();
})();
