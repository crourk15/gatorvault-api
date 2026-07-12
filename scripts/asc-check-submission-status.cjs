#!/usr/bin/env node
/** Read App Store Connect submission status for GatorVault Insider 1.0 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const STORAGE_PATH = path.join(process.env.USERPROFILE || '', '.cursor', 'asc-playwright-storage.json');
const SHOT_PATH = path.join(__dirname, '..', 'docs', 'app-store', 'asc-status-check.png');
const EMAIL = process.env.ASC_EMAIL || '';
const PASSWORD = process.env.ASC_PASSWORD || '';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fillAppleLogin(page) {
  if (!EMAIL || !PASSWORD) throw new Error('Set ASC_EMAIL and ASC_PASSWORD if session expired.');
  for (const target of [page, ...page.frames()]) {
    const emailField = target.locator('#account_name_text_field, input[type="email"]');
    if (!(await emailField.count())) continue;
    await emailField.first().pressSequentially(EMAIL, { delay: 20 });
    await target.locator('#sign-in, button:has-text("Continue")').first().click({ force: true });
    await sleep(2000);
    const pwdField = target.locator('#password_text_field, input[type="password"]');
    await pwdField.first().waitFor({ state: 'visible', timeout: 20000 });
    await pwdField.first().pressSequentially(PASSWORD, { delay: 20 });
    await sleep(500);
    const signInBtn = target.locator('#sign-in, button:has-text("Sign In")').first();
    if (await signInBtn.isEnabled()) await signInBtn.click();
    else await pwdField.first().press('Enter');
    console.log('[asc-status] Approve 2FA on your device if prompted.');
    return;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = fs.existsSync(STORAGE_PATH)
    ? await browser.newContext({ storageState: STORAGE_PATH, viewport: { width: 1440, height: 900 } })
    : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('https://appstoreconnect.apple.com/apps', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await sleep(2500);
    if (page.url().includes('login')) {
      await fillAppleLogin(page);
      await page.waitForURL(/appstoreconnect\.apple\.com(?!\/login)/, { timeout: 180000 });
      await page.goto('https://appstoreconnect.apple.com/apps', { waitUntil: 'domcontentloaded' });
      await sleep(2000);
    }

    await page.getByText(/GatorVault Insider/i).first().click({ timeout: 60000 });
    await sleep(2000);
    const distribution = page.getByRole('link', { name: /Distribution/i }).first();
    if (await distribution.count()) await distribution.click().catch(() => {});
    await sleep(1500);
    await page.getByText(/1\.0|Rejected|Waiting|Review|Submitted/i).first().click({ timeout: 30000 }).catch(() => {});
    await sleep(2000);

    const viewSubmission = page.getByRole('link', { name: /View Submission/i });
    if (await viewSubmission.count()) await viewSubmission.first().click({ timeout: 15000 });
    await sleep(3000);

    fs.mkdirSync(path.dirname(SHOT_PATH), { recursive: true });
    await page.screenshot({ path: SHOT_PATH, fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const statusPatterns = [
      /Waiting for Review/i,
      /In Review/i,
      /Rejected/i,
      /Ready for Review/i,
      /Pending Developer Release/i,
      /Prepare for Submission/i,
      /Waiting for Export Compliance/i,
      /Metadata Rejected/i,
      /Developer Rejected/i,
    ];
    const found = statusPatterns.filter((p) => p.test(bodyText)).map((p) => p.source.replace(/\\i$/, ''));
    const hasReply = /Guideline 2\.1|Information Needed|We have reprovisioned|Thank you,\s*Charles/i.test(bodyText);
    const hasSubmitBtn = await page.getByRole('button', { name: /Submit for Review|Add for Review|Resubmit/i }).count();

    console.log(JSON.stringify({
      url: page.url(),
      statusesFound: found,
      replyVisibleInThread: hasReply,
      submitButtonVisible: hasSubmitBtn > 0,
      screenshot: SHOT_PATH,
    }, null, 2));
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[asc-status]', err.message || err);
  process.exit(1);
});
