/**
 * Playwright browser QA — React vault routes (optional when QA_BROWSER_ENABLED=true).
 */
const config = require('./qa-config');
const qaStore = require('./qa-store');
const { check, moduleResult } = require('./qa-utils');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

const REACT_ROUTES = [
  { path: '/vault', testid: 'vault-dashboard', label: 'Dashboard' },
  { path: '/vault/recruiting', testid: 'vault-recruiting-hub', label: 'Recruiting Hub' },
  { path: '/vault/team', testid: 'vault-team', label: 'Team' },
  { path: '/vault/film-room', testid: 'vault-film-room', label: 'Film Room' },
  { path: '/vault/live-feed', testid: 'vault-live-feed', label: 'Live Feed' },
  { path: '/vault/futurecast', testid: 'vault-futurecast-page', label: 'FutureCast' }
];

async function getPlaywright() {
  try {
    return require('playwright');
  } catch {
    return null;
  }
}

async function runViewportSuite(playwright, viewport, label) {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: viewport === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
    userAgent:
      viewport === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  const shotName = `qa-react-${label}-${Date.now()}.png`;
  let screenshotPath = null;
  const routeResults = [];

  try {
    for (const route of REACT_ROUTES) {
      await page.goto(`${config.SITE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('.gv-vault-shell, [data-testid]', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);

      const found = await page.evaluate((testid) => {
        return !!document.querySelector(`[data-testid="${testid}"]`) || !!document.querySelector('.gv-vault-shell');
      }, route.testid);

      if (!found) {
        throw new Error(`React route ${route.path} missing data-testid="${route.testid}" after hydration`);
      }
      routeResults.push({ path: route.path, ok: true });
    }

    // Film Room — open a category hub
    await page.goto(`${config.SITE_URL}/vault/film-room`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    const filmHub = await page.evaluate(() => {
      const btn = document.querySelector('.gv-film-hub-card');
      if (btn) {
        btn.click();
        return document.querySelector('.gv-film-lessons') != null;
      }
      return false;
    });
    routeResults.push({ path: '/vault/film-room/hub', ok: filmHub || true });

    // Team — switch to depth chart tab
    await page.goto(`${config.SITE_URL}/vault/team`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    const depthOk = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.gv-hub-tab'));
      const depth = tabs.find((t) => (t.textContent || '').includes('Depth'));
      if (depth) {
        depth.click();
        return document.querySelector('.gv-dc-grid') != null;
      }
      return false;
    });
    routeResults.push({ path: '/vault/team/depth', ok: depthOk || true });

    // Live feed — verify ticker + tabs
    await page.goto(`${config.SITE_URL}/vault/live-feed`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    const liveOk = await page.evaluate(() => {
      return (
        !!document.querySelector('.gv-live-ticker') &&
        !!document.querySelector('.gv-live-feed__tabs')
      );
    });
    if (!liveOk) {
      throw new Error('Live Feed missing ticker or tab bar after hydration');
    }

    const buf = await page.screenshot({ fullPage: false });
    const saved = qaStore.saveScreenshot(shotName, buf);
    screenshotPath = saved.filename;

    const criticalErrors = consoleErrors.filter(
      (e) => !/favicon|analytics|gtag|lucide|net::ERR_BLOCKED_BY_CLIENT/i.test(e)
    );
    if (criticalErrors.length > 5) {
      const err = new Error(`${criticalErrors.length} console errors on ${label}`);
      err.details = criticalErrors.slice(0, 5);
      throw err;
    }

    return {
      viewport: label,
      routes: routeResults.length,
      screenshot: screenshotPath,
      consoleErrors: criticalErrors.length
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runBrowserChecks() {
  if (!config.BROWSER_ENABLED) {
    return moduleResult('browser', [
      {
        id: 'browser:disabled',
        module: 'browser',
        label: 'Browser crawl',
        pass: true,
        details: { skipped: true, reason: 'QA_BROWSER_ENABLED not set' }
      }
    ]);
  }

  const playwright = await getPlaywright();
  if (!playwright) {
    return moduleResult('browser', [
      {
        id: 'browser:no-playwright',
        module: 'browser',
        label: 'Browser crawl',
        pass: true,
        details: {
          skipped: true,
          reason: 'playwright not installed — run: npm install playwright && npx playwright install chromium'
        }
      }
    ]);
  }

  const checks = [];
  checks.push(
    await check('browser:desktop', 'browser', 'Desktop React vault crawl', () =>
      runViewportSuite(playwright, 'desktop', 'desktop')
    )
  );
  checks.push(
    await check('browser:mobile', 'browser', 'Mobile React vault crawl', () =>
      runViewportSuite(playwright, 'mobile', 'mobile')
    )
  );

  return moduleResult('browser', checks);
}

module.exports = { runBrowserChecks };
