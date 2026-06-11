/**
 * Playwright browser QA — optional when QA_BROWSER_ENABLED=true and playwright installed.
 */
const config = require('./qa-config');
const qaStore = require('./qa-store');
const { check, moduleResult } = require('./qa-utils');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

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

  const shotName = `qa-${label}-${Date.now()}.png`;
  let screenshotPath = null;

  try {
    await page.goto(config.SITE_URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);

    // Film Room verified sources
    const filmResult = await page.evaluate(async (apiUrl) => {
      const out = { lesson: null, sourceModal: false, legacy: null };
      try {
        const r = await fetch(`${apiUrl}/api/film-room/catalog`);
        const j = await r.json();
        const lesson = (j.items || []).find((i) => i.knowledgeEngine || i.noVideo);
        const legacy = (j.items || []).find((i) => i.youtubeId || i.embedUrl);
        if (legacy) out.legacy = { title: legacy.title, hasEmbed: !!(legacy.youtubeId || legacy.embedUrl) };
        if (lesson && typeof window.openHighlightPlayer === 'function') {
          window.openHighlightPlayer(lesson);
          out.lesson = lesson.title;
          await new Promise((res) => setTimeout(res, 800));
          const btn = document.querySelector('.gv-film-source');
          if (btn && typeof window.gvOpenVerifiedSource === 'function') {
            const sid = btn.getAttribute('data-source-id');
            window.gvOpenVerifiedSource(sid);
            await new Promise((res) => setTimeout(res, 400));
            const modal = document.getElementById('gv-verified-source-modal');
            out.sourceModal = modal && !modal.classList.contains('hidden');
            if (typeof window.gvCloseVerifiedSource === 'function') window.gvCloseVerifiedSource();
          }
          if (typeof window.closeHighlightPlayer === 'function') window.closeHighlightPlayer();
        }
      } catch (e) {
        out.error = e.message;
      }
      return out;
    }, config.API_URL);

    if (filmResult.error) throw new Error(filmResult.error);
    if (filmResult.lesson && !filmResult.sourceModal) {
      throw new Error('Verified source modal did not open after tapping .gv-film-source');
    }

    // Legacy video modal
    if (filmResult.legacy) {
      await page.evaluate(async (apiUrl) => {
        const r = await fetch(`${apiUrl}/api/film-room/catalog`);
        const j = await r.json();
        const legacy = (j.items || []).find((i) => i.youtubeId || i.embedUrl);
        if (legacy && typeof window.openHighlightPlayer === 'function') {
          window.openHighlightPlayer(legacy);
          await new Promise((res) => setTimeout(res, 600));
          if (typeof window.closeHighlightPlayer === 'function') window.closeHighlightPlayer();
        }
      }, config.API_URL);
    }

    // Team tab card modal
    await page.evaluate(() => {
      if (typeof window.gvOpenTeamDetail === 'function') {
        window.gvOpenTeamDetail('era', 'modern');
        if (typeof window.gvCloseTeamDetail === 'function') window.gvCloseTeamDetail();
      }
    });

    const buf = await page.screenshot({ fullPage: false });
    const saved = qaStore.saveScreenshot(shotName, buf);
    screenshotPath = saved.filename;

    const criticalErrors = consoleErrors.filter(
      (e) => !/favicon|analytics|gtag|lucide|net::ERR_BLOCKED_BY_CLIENT/i.test(e)
    );
    if (criticalErrors.length > 3) {
      const err = new Error(`${criticalErrors.length} console errors on ${label}`);
      err.details = criticalErrors.slice(0, 5);
      err.repro = `Open ${config.SITE_URL} in ${label} viewport; check browser console`;
      throw err;
    }

    return {
      viewport: label,
      filmLesson: filmResult.lesson,
      sourceModal: filmResult.sourceModal,
      legacyVideo: filmResult.legacy?.title || null,
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
    await check('browser:desktop', 'browser', 'Desktop browser crawl', () => runViewportSuite(playwright, 'desktop', 'desktop'))
  );
  checks.push(
    await check('browser:mobile', 'browser', 'Mobile browser crawl', () => runViewportSuite(playwright, 'mobile', 'mobile'))
  );

  return moduleResult('browser', checks);
}

module.exports = { runBrowserChecks };
