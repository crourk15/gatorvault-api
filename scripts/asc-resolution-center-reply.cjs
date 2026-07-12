#!/usr/bin/env node
/**
 * Submit App Store Resolution Center reply via browser automation.
 * Uses env vars only — never commit credentials.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const REPLY_PATH = path.join(__dirname, '..', 'docs', 'APP_STORE_RESOLUTION_REPLY_JUL3.txt');
const STORAGE_PATH = path.join(process.env.USERPROFILE || '', '.cursor', 'asc-playwright-storage.json');
const SHOT_PATH = path.join(__dirname, '..', 'docs', 'app-store', 'asc-last-step.png');
const PROMO_TEXT =
  'Florida Gators football intel: FutureCast, recruiting, roster depth, live pulse, and member community - all in one app.';
const REVIEW_NOTES =
  'Demo account reprovisioned on production with War Room tier. Sign in: Join -> Sign in tab (not Create account). Do NOT delete demo account. Support: support@gatorvaultinsider.com';
const EMAIL = process.env.ASC_EMAIL || '';
const PASSWORD = process.env.ASC_PASSWORD || '';
const HEADLESS = process.env.ASC_HEADLESS === 'true';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fillAppleLogin(page) {
  if (!EMAIL || !PASSWORD) throw new Error('Set ASC_EMAIL and ASC_PASSWORD for Apple sign-in.');
  const targets = [page, ...page.frames()];
  for (const target of targets) {
    const emailField = target.locator('#account_name_text_field, input[type="email"], input[name="accountName"]');
    if (!(await emailField.count())) continue;
    await emailField.first().click();
    await emailField.first().fill('');
    await emailField.first().pressSequentially(EMAIL, { delay: 30 });
    await sleep(500);
    await target.locator('#sign-in, button:has-text("Continue")').first().click({ force: true });
    await sleep(2000);
    const pwdField = target.locator('#password_text_field, input[type="password"]');
    await pwdField.first().waitFor({ state: 'visible', timeout: 20000 });
    await pwdField.first().pressSequentially(PASSWORD, { delay: 30 });
    await sleep(800);
    const signInBtn = target.locator('#sign-in, button:has-text("Sign In")').first();
    for (let i = 0; i < 20; i += 1) {
      if (await signInBtn.isEnabled()) break;
      await sleep(250);
    }
    if (await signInBtn.isEnabled()) await signInBtn.click();
    else await pwdField.first().press('Enter');
    console.log('[asc] Credentials submitted — approve 2FA on your device if prompted.');
    return true;
  }
  return false;
}

async function ensureSignedIn(page) {
  await page.goto('https://appstoreconnect.apple.com/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);
  if (page.url().includes('appstoreconnect.apple.com') && !page.url().includes('login')) return;
  await fillAppleLogin(page);
  await page.waitForURL(/appstoreconnect\.apple\.com(?!\/login)/, { timeout: 180000 });
  await sleep(3000);
}

async function openAppVersion(page) {
  await page.goto('https://appstoreconnect.apple.com/apps', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2500);
  const search = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
  if (await search.count()) {
    await search.fill('GatorVault Insider');
    await sleep(1500);
  }
  await page.getByText(/GatorVault Insider/i).first().click({ timeout: 60000 });
  await sleep(2000);
  const distribution = page.getByRole('link', { name: /Distribution/i }).first();
  if (await distribution.count()) await distribution.click({ timeout: 10000 }).catch(() => {});
  await sleep(1500);
  await page.getByText(/1\.0|Rejected|Waiting for Review|In Review/i).first().click({ timeout: 30000 });
  await sleep(2000);
}

async function setFieldIfNeeded(page, labelPattern, value) {
  const field = page.getByRole('textbox', { name: labelPattern }).first();
  if (!(await field.count())) return false;
  const current = await field.inputValue().catch(() => '');
  if (current.trim() === value.trim()) return false;
  await field.fill(value);
  return true;
}

async function saveIfEnabled(page) {
  const save = page.getByRole('button', { name: /^Save$/i }).first();
  if (await save.count() && (await save.isEnabled())) {
    await save.click({ timeout: 10000 });
    await sleep(2500);
    return true;
  }
  return false;
}

async function updateMetadata(page) {
  let changed = false;
  changed = (await setFieldIfNeeded(page, /Promotional Text/i, PROMO_TEXT)) || changed;
  changed = (await setFieldIfNeeded(page, /^Notes$/i, REVIEW_NOTES)) || changed;
  if (changed) {
    await saveIfEnabled(page);
    console.log('[asc] Metadata/review notes saved.');
  } else {
    console.log('[asc] Metadata/review notes already correct.');
  }
}

async function openSubmissionMessages(page) {
  const viewSubmission = page.getByRole('link', { name: /View Submission/i });
  if (await viewSubmission.count()) {
    await viewSubmission.first().click({ timeout: 20000 });
    await sleep(3000);
    return;
  }
  const appReview = page.getByRole('link', { name: /^App Review$/i }).first();
  if (await appReview.count()) {
    await appReview.click({ timeout: 20000 });
    await sleep(3000);
  }
}

async function sendReply(page, message) {
  const replyBtn = page.getByRole('button', { name: /^Reply$/i }).or(page.getByText(/^Reply to App Review$/i));
  if (await replyBtn.count()) await replyBtn.first().click({ timeout: 20000 });
  await sleep(1500);

  const textarea = page
    .getByRole('textbox')
    .filter({ hasNot: page.locator('[name*="promotional" i]') })
    .last();
  await textarea.waitFor({ state: 'visible', timeout: 30000 });
  await textarea.fill(message);
  await sleep(1000);

  for (const name of [/^Send$/i, /^Submit$/i, /^Reply$/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.count() && (await btn.isVisible()) && (await btn.isEnabled())) {
      await btn.click({ timeout: 15000 });
      await sleep(4000);
      console.log('[asc] Clicked', name.toString());
      return;
    }
  }
  throw new Error('Could not find Send button — reply may be filled; click Send manually.');
}

async function main() {
  const message = fs.readFileSync(REPLY_PATH, 'utf8').trim();
  const browser = await chromium.launch({ headless: HEADLESS, channel: 'chrome', slowMo: 40 });
  const context = fs.existsSync(STORAGE_PATH)
    ? await browser.newContext({ storageState: STORAGE_PATH, viewport: { width: 1440, height: 900 } })
    : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('[asc] Signing in…');
    await ensureSignedIn(page);
    console.log('[asc] Opening app version…');
    await openAppVersion(page);
    await updateMetadata(page);
    console.log('[asc] Opening submission messages…');
    await openSubmissionMessages(page);
    console.log('[asc] Sending Resolution Center reply…');
    await sendReply(page, message);
    console.log('[asc] Reply sent successfully.');
    fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
    await context.storageState({ path: STORAGE_PATH });
  } catch (err) {
    fs.mkdirSync(path.dirname(SHOT_PATH), { recursive: true });
    await page.screenshot({ path: SHOT_PATH, fullPage: true }).catch(() => {});
    console.error('[asc] Error:', err.message);
    console.error(`[asc] Screenshot: ${SHOT_PATH}`);
    if (/click Send manually/i.test(err.message)) await sleep(120000);
    else await sleep(60000);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
