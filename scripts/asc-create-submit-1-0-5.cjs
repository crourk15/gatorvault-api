#!/usr/bin/env node
/**
 * Create App Store Connect iOS version 1.0.5, attach build 25, fill What's New,
 * and submit for review (GatorVault Insider only).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const STORAGE_PATH = path.join(process.env.USERPROFILE || '', '.cursor', 'asc-playwright-storage.json');
const SHOT_PATH = path.join(__dirname, '..', 'docs', 'app-store', 'asc-1-0-5-submit.png');
const EMAIL = process.env.ASC_EMAIL || '';
const PASSWORD = process.env.ASC_PASSWORD || '';
const APP_NAME = /GatorVault Insider/i;
const APP_ID = '6783848215';
const VERSION = '1.0.5';
const BUILD = '25';
const WHATS_NEW =
  'Membership & Account stays open if the network blips — no more bounce to the landing page. Sign-in no longer drops while you browse FutureCast and other vault tabs. Player high school vs hometown display fix. Game Zone and Alerts fan-facing copy cleanup.';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(...args) {
  console.log('[asc-1.0.5]', ...args);
}

async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(350);
  }
  await clickFirstVisible(
    page,
    [
      page.getByRole('button', { name: /^Done$/i }),
      page.getByRole('button', { name: /^Cancel$/i }),
      page.getByRole('button', { name: /^Close$/i }),
      page.locator('[role="dialog"] button:has-text("Done")'),
    ],
    { timeout: 1500 }
  );
  await sleep(400);
}

async function waitForAscContent(page, pattern, timeoutMs = 90000) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = await page.locator('body').innerText().catch(() => '');
    if (re.test(t) && t.length > 250) return t;
    await sleep(2000);
  }
  return await page.locator('body').innerText().catch(() => '');
}

async function fillAppleLogin(page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Login required. Set ASC_EMAIL and ASC_PASSWORD, or approve 2FA in the open browser.');
  }
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
    log('Approve 2FA on your device if prompted.');
    return;
  }
}

async function waitForAppsList(page, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();
    if (!url.includes('/login') && /appstoreconnect\.apple\.com/.test(url)) {
      if ((await page.getByText(APP_NAME).count()) > 0) return true;
    }
    await sleep(2000);
  }
  return false;
}

async function ensureLoggedIn(page, context) {
  await page.goto('https://appstoreconnect.apple.com/apps', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await sleep(2500);

  if (page.url().includes('login') || page.url().includes('idmsa') || page.url().includes('idms')) {
    console.log('');
    console.log('============================================================');
    console.log('CLEAR: Charles must log in / approve 2FA in the browser window.');
    console.log('Waiting up to 3 minutes for the App Store Connect apps list...');
    console.log('============================================================');
    console.log('');

    if (EMAIL && PASSWORD) {
      try {
        await fillAppleLogin(page);
      } catch (e) {
        log('Auto-login failed or incomplete:', e.message || e);
        log('Complete login manually in the browser.');
      }
    }

    const ok = await waitForAppsList(page, 180000);
    if (!ok) throw new Error('Timed out waiting for apps list after login/2FA (3 minutes).');

    try {
      await context.storageState({ path: STORAGE_PATH });
      log('Saved storageState to', STORAGE_PATH);
    } catch (e) {
      log('Could not save storageState:', e.message || e);
    }

    if (!page.url().includes('/apps')) {
      await page.goto('https://appstoreconnect.apple.com/apps', {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await sleep(2000);
    }
  }
}

async function clickFirstVisible(page, locators, opts = {}) {
  const timeout = opts.timeout || 15000;
  for (const loc of locators) {
    try {
      const el = typeof loc === 'string' ? page.locator(loc) : loc;
      if (!(await el.count())) continue;
      const first = el.first();
      if (await first.isVisible({ timeout: 2000 }).catch(() => false)) {
        await first.click({ timeout });
        return true;
      }
    } catch (_) {}
  }
  return false;
}

async function bodySnippet(page, max = 2500) {
  try {
    const t = await page.locator('body').innerText({ timeout: 10000 });
    return (t || '').replace(/\s+/g, ' ').trim().slice(0, max);
  } catch {
    return '';
  }
}

async function extractStatusText(page) {
  const bodyText = await bodySnippet(page, 8000);
  const statusPatterns = [
    /Waiting for Review/i,
    /In Review/i,
    /Rejected/i,
    /Ready for Review/i,
    /Ready for Sale/i,
    /Ready for Distribution/i,
    /Pending Developer Release/i,
    /Prepare for Submission/i,
    /Waiting for Export Compliance/i,
    /Metadata Rejected/i,
    /Developer Rejected/i,
    /Invalid Binary/i,
    /Missing Compliance/i,
    /Processing/i,
  ];
  const found = statusPatterns
    .filter((p) => p.test(bodyText))
    .map((p) => {
      const m = bodyText.match(p);
      return m ? m[0] : p.source;
    });
  return { found, bodyText };
}

async function attachBuild25(page) {
  log('Looking for Build selector / build 25...');
  await dismissOverlays(page);

  const bodyBefore = await page.locator('body').innerText().catch(() => '');
  if (/BUILD[\s\S]{0,120}25[\s\S]{0,40}1\.0\.5/i.test(bodyBefore)) {
    log('Build 25 already attached — skipping picker (avoids drop-holder overlay).');
    return { attached: true, already: true };
  }

  const opened = await clickFirstVisible(page, [
    page.getByRole('button', { name: /Select a build|Add Build|Choose Build/i }),
    page.getByText(/Select a build|No Build Selected|Add Build/i),
  ]);
  await sleep(2000);

  let picked = false;
  const candidates = [
    page.locator('[role="dialog"] tr:has-text("25")'),
    page.locator('.drop-holder tr:has-text("25"), .holder-el tr:has-text("25")'),
    page.locator('[role="row"]:has-text("25")'),
  ];
  for (const c of candidates) {
    if (!(await c.count())) continue;
    try {
      await c.first().click({ timeout: 10000 });
      picked = true;
      log('Clicked build 25 candidate.');
      break;
    } catch (_) {}
  }

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /Done|OK|Add|Save|Select/i }),
    page.locator('[role="dialog"] button:has-text("Done")'),
  ]);
  await sleep(1000);
  await dismissOverlays(page);

  if (!picked && !opened) {
    return { attached: false, message: 'Could not open build picker or select 14.' };
  }
  return { attached: true, picked };
}

async function fillWhatsNew(page) {
  log("Checking What's New...");
  await page
    .getByText(/What.?s New in This Version/i)
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await sleep(500);

  const candidates = [
    page.getByRole('textbox', { name: /What.?s New/i }),
    page.getByLabel(/What.?s New in This Version/i),
    page.getByLabel(/What.?s New/i),
    page.locator('xpath=//*[contains(., "What\'s New in This Version")]/following::textarea[1]'),
    page.locator('textarea[aria-label*="What" i]'),
  ];

  for (const ed of candidates) {
    if (!(await ed.count())) continue;
    const el = ed.first();
    try {
      await el.scrollIntoViewIfNeeded();
      const current = (await el.inputValue().catch(() => '')) || '';
      if (/Faster Vault loading/i.test(current) || current.trim().length > 20) {
        log("What's New already filled.");
        return { filled: false, already: true };
      }
      await el.click({ timeout: 5000 });
      await el.fill(WHATS_NEW);
      await sleep(400);
      const after = await el.inputValue().catch(() => '');
      if (/Faster Vault loading/i.test(after)) {
        log("Filled What's New.");
        return { filled: true, already: false };
      }
    } catch (e) {
      log('WhatsNew candidate failed:', e.message || e);
    }
  }

  // Last resort: find textarea whose nearby label mentions What's New
  const textareas = page.locator('textarea');
  const n = await textareas.count();
  for (let i = 0; i < n; i++) {
    const ta = textareas.nth(i);
    const meta = await ta.evaluate((node) => {
      const label =
        node.getAttribute('aria-label') ||
        node.getAttribute('placeholder') ||
        (node.closest('div') && node.closest('div').innerText) ||
        '';
      return String(label).slice(0, 200);
    });
    if (!/what.?s new/i.test(meta)) continue;
    const current = await ta.inputValue().catch(() => '');
    if (current.trim().length > 20) return { filled: false, already: true };
    await ta.fill(WHATS_NEW);
    log("Filled What's New via textarea scan.");
    return { filled: true, already: false };
  }

  return { filled: false, already: false, message: "Could not locate What's New field" };
}

async function submitForReview(page) {
  log('Looking for Add for Review / Submit for Review...');
  await dismissOverlays(page);

  const actions = [/Add for Review/i, /Submit to App Review/i, /Submit for Review/i, /Resubmit/i];
  const clicked = [];

  for (const name of actions) {
    const btn = page.getByRole('button', { name }).first();
    if (!(await btn.count())) continue;
    if (!(await btn.isVisible().catch(() => false))) continue;
    if (!(await btn.isEnabled().catch(() => false))) continue;
    const label = ((await btn.innerText().catch(() => '')) || name.toString()).trim();
    log(`Clicking: ${label}`);
    await dismissOverlays(page);
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await btn.click({ timeout: 10000 });
    } catch (_) {
      log('Normal click blocked by overlay — force clicking');
      await btn.click({ timeout: 10000, force: true });
    }
    clicked.push(label);
    await sleep(3000);

    const nos = page.getByRole('radio', { name: /^No$/i });
    const nc = Math.min(await nos.count(), 8);
    for (let r = 0; r < nc; r++) await nos.nth(r).click({ force: true }).catch(() => {});

    for (let i = 0; i < 8; i++) {
      const confirm = await clickFirstVisible(
        page,
        [
          page.getByRole('button', { name: /Submit(?:\s+to App Review)?$/i }),
          page.getByRole('button', { name: /Continue|Confirm|Done|Yes|OK|Send/i }),
          page.locator('[role="dialog"] button:has-text("Submit")'),
        ],
        { timeout: 4000 }
      );
      if (!confirm) break;
      await sleep(2000);
    }
  }

  const viewSubmission = page.getByRole('link', { name: /View Submission/i });
  if (await viewSubmission.count()) {
    await viewSubmission.first().click({ timeout: 15000 }).catch(() => {});
    await sleep(3000);
    const submit2 = page.getByRole('button', { name: /Submit to App Review|Submit for Review/i }).first();
    if (await submit2.count() && (await submit2.isVisible().catch(() => false))) {
      const label = ((await submit2.innerText().catch(() => '')) || 'Submit').trim();
      log(`Clicking on submission page: ${label}`);
      await submit2.click({ timeout: 20000 }).catch(async () => submit2.click({ force: true }));
      clicked.push(label);
      await sleep(2500);
      const nos = page.getByRole('radio', { name: /^No$/i });
      const nc = Math.min(await nos.count(), 8);
      for (let r = 0; r < nc; r++) await nos.nth(r).click({ force: true }).catch(() => {});
      await clickFirstVisible(
        page,
        [
          page.getByRole('button', { name: /Submit(?:\s+to App Review)?$/i }),
          page.getByRole('button', { name: /Continue|Confirm/i }),
        ],
        { timeout: 5000 }
      );
      await sleep(3000);
    }
  }

  
  // Open App Review drafts and Submit for Review if still draft
  try {
    await page.goto(`https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/reviewsubmissions`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await sleep(4000);
    const draftRow = page.locator('tr:has-text("1.0.5"), [role="row"]:has-text("1.0.5")').first();
    if (await draftRow.count()) await draftRow.click().catch(() => {});
    else await page.getByText(/iOS 1\.0\.5|Today at/i).first().click().catch(() => {});
    await sleep(2500);
    const submitDraft = page.getByRole('button', { name: /Submit for Review|Submit to App Review/i }).first();
    if (await submitDraft.count() && (await submitDraft.isVisible().catch(() => false))) {
      const label = ((await submitDraft.innerText()) || 'Submit').trim();
      await submitDraft.click({ timeout: 15000 }).catch(async () => submitDraft.click({ force: true }));
      clicked.push('draft:' + label);
      await sleep(3000);
    }
  } catch (e) {
    log('reviewsubmissions step:', e.message || e);
  }
  if (!clicked.length) {
    return {
      submitted: false,
      message: 'No Add for Review / Submit for Review / Submit to App Review button visible.',
    };
  }
  return { submitted: true, action: clicked.join(' -> ') };
}

async function main() {
  const headlessPreferred = process.env.ASC_HEADLESS === '1';
  let browser;
  try {
    browser = await chromium.launch({ headless: headlessPreferred, channel: 'chrome' });
  } catch (e) {
    log('chrome launch failed, retrying headless true:', e.message || e);
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  }

  const contextOpts = { viewport: { width: 1440, height: 900 } };
  if (fs.existsSync(STORAGE_PATH)) {
    contextOpts.storageState = STORAGE_PATH;
    log('Loaded storageState from', STORAGE_PATH);
  } else {
    log('No storageState file — will need login.');
  }

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  const outcome = {
    app: 'GatorVault Insider',
    version: VERSION,
    build: BUILD,
    createdVersion: false,
    attachedBuild: false,
    whatsNew: null,
    submitted: false,
    blocked: null,
    statusesFound: [],
    url: '',
    screenshot: SHOT_PATH,
    finalStatusText: '',
  };

  try {
    await ensureLoggedIn(page, context);

    const appLink = page.getByText(APP_NAME).first();
    await appLink.waitFor({ state: 'visible', timeout: 60000 });
    const appText = await appLink.innerText();
    if (!/GatorVault Insider/i.test(appText)) {
      throw new Error(`Refusing to proceed — unexpected app text: ${appText}`);
    }
    log('Opening app:', appText.trim());
    await appLink.click({ timeout: 30000 });
    await sleep(2500);

    const urlNow = page.url();
    log('App page:', urlNow);
    if (!/GatorVault/i.test(await bodySnippet(page, 800))) {
      throw new Error('Wrong app page — GatorVault not found in body. Aborting.');
    }

    // Go straight to known inflight 1.0.5 page
    await page.goto(`https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/ios/version/inflight`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await sleep(4000);
    const inflightText = await waitForAscContent(
      page,
      /1\.0\.5|Build|What.?s New|Prepare for Submission|Add for Review/i,
      90000
    );
    if (!/1\.0\.5/i.test(inflightText)) {
      throw new Error('Inflight page did not show 1.0.5. UI: ' + inflightText.slice(0, 400));
    }
    log('Opened 1.0.5 inflight page.');

    const buildResult = await attachBuild25(page);
    outcome.attachedBuild = !!buildResult.attached;
    if (!buildResult.attached) {
      outcome.blocked = buildResult.message;
      log('Build attach issue:', buildResult.message);
    }

    outcome.whatsNew = await fillWhatsNew(page);

    await dismissOverlays(page);
    const saveBtn = page.getByRole('button', { name: /^Save$/i }).first();
    if (await saveBtn.count() && (await saveBtn.isEnabled().catch(() => false))) {
      await saveBtn.click();
      await sleep(2500);
      log('Saved version page.');
    }
    await dismissOverlays(page);

    const sub = await submitForReview(page);
    outcome.submitted = !!sub.submitted;
    outcome.submitAction = sub.action || null;
    if (!sub.submitted) {
      log(sub.message);
      if (!outcome.blocked) outcome.blocked = sub.message;
    }

    try {
      await context.storageState({ path: STORAGE_PATH });
    } catch (_) {}

    await sleep(2500);
    fs.mkdirSync(path.dirname(SHOT_PATH), { recursive: true });
    await page.screenshot({ path: SHOT_PATH, fullPage: true });

    const st = await extractStatusText(page);
    outcome.statusesFound = st.found;
    outcome.finalStatusText = st.found.join(' | ') || st.bodyText.slice(0, 400) || '(no status pattern matched)';
    outcome.url = page.url();
    outcome.whatsNewOnPage = /Faster Vault loading/i.test(st.bodyText);
    outcome.addForReviewStillVisible =
      (await page.getByRole('button', { name: /Add for Review/i }).count()) > 0;

    console.log('');
    console.log('======== FINAL OUTCOME ========');
    console.log(JSON.stringify(outcome, null, 2));
    console.log('Status text found:', outcome.finalStatusText);
    console.log('Screenshot:', SHOT_PATH);
    console.log('================================');
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[asc-1.0.5] FATAL:', err.message || err);
  process.exit(1);
});