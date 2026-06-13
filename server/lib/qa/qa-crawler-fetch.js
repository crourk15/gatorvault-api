/**
 * QA Crawler — Phase 1: Fetch
 * Load pages, wait for JS hydration, capture DOM/CSS/screenshot/network timing.
 */
const fs = require('fs');
const path = require('path');
const config = require('./qa-config');
const qaStore = require('./qa-store');
const { fetchText, fetchSiteBundleText } = require('./qa-utils');
const { SITE_SECTIONS, LOCAL_ASSETS } = require('./qa-coverage-map');

const SERVER_ROOT = path.join(__dirname, '..', '..');
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function getPlaywright() {
  try {
    return require('playwright');
  } catch {
    return null;
  }
}

function readLocalAsset(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

function readMonolithArchive() {
  return readLocalAsset('legacy-index.html') || readLocalAsset('index.html');
}

function staticHtmlForSection(section) {
  if (section.legacy) return readMonolithArchive();
  if (section.page === '/vault') return readLocalAsset('vault/index.html') || readLocalAsset('index.html');
  if (section.page && section.page.startsWith('/vault/')) {
    const rel = `${section.page.replace(/^\//, '')}/index.html`;
    return readLocalAsset(rel) || readLocalAsset('index.html');
  }
  return readLocalAsset('index.html');
}

function buildStaticSnapshot(section, viewport) {
  const html =
    section.page === '/admin'
      ? readLocalAsset('admin.html') || readLocalAsset('index.html')
      : staticHtmlForSection(section);
  const teamCss = readLocalAsset('css/gv-team.css');
  const teamJs = readLocalAsset('js/gv-team-mobile.js');
  const css = { 'css/gv-team.css': teamCss };

  const elements = (section.selectors || []).map((sel) => {
    const needle = sel.startsWith('#') ? `id="${sel.slice(1)}"` : sel;
    const exists = html.includes(needle) || teamJs.includes(needle) || teamCss.includes(needle);
    return { selector: sel, domPath: sel, exists, source: 'static' };
  });

  return {
    sectionId: section.id,
    label: section.label,
    page: section.page || '/',
    viewport,
    url: `${config.SITE_URL}${section.page || '/'}`,
    fetchedAt: new Date().toISOString(),
    hydrated: false,
    source: 'static',
    htmlLength: html.length,
    css,
    dom: { elements, overflow: [], overlaps: [], network: [] },
    screenshot: null,
    network: [],
    timingMs: 0
  };
}

async function bootstrapVault(page, viewport) {
  await page.goto(`${config.SITE_URL}/vault`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.gv-vault-shell, [data-testid="vault-dashboard"]', { timeout: 25000 });
  if (viewport === 'mobile') {
    await page.setViewportSize(MOBILE_VIEWPORT);
  }
  await page.waitForTimeout(2000);
}

async function navigateSection(page, section, viewport) {
  const nav = viewport === 'mobile' ? section.mobile?.nav : section.desktop?.nav;
  if (!nav) return;

  if (nav.fn === 'gvMobileShowTab') {
    await page.evaluate((tab) => {
      if (typeof gvMobileShowTab === 'function') gvMobileShowTab(tab);
    }, nav.arg);
    await page.waitForTimeout(1500);
  } else if (nav.fn === 'showVTab') {
    await page.evaluate((tab) => {
      if (typeof showVTab === 'function') showVTab(tab);
    }, nav.arg);
    await page.waitForTimeout(1500);
  }
}

async function captureDomMetrics(page, section) {
  return page.evaluate((selectors) => {
    const elements = [];
    const overflow = [];
    const overlaps = [];

    selectors.forEach((sel) => {
      let el;
      try {
        el = document.querySelector(sel);
      } catch {
        el = null;
      }
      if (!el) {
        elements.push({ selector: sel, domPath: sel, exists: false });
        return;
      }

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const entry = {
        selector: sel,
        domPath: sel,
        exists: true,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        zIndex: style.zIndex,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        background: style.background || style.backgroundImage,
        textLength: (el.textContent || '').trim().length,
        clipped:
          el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2
      };
      elements.push(entry);

      if (entry.clipped && style.overflowY !== 'auto' && style.overflowY !== 'scroll') {
        overflow.push({
          selector: sel,
          type: el.scrollWidth > el.clientWidth + 2 ? 'horizontal' : 'vertical',
          deltaH: el.scrollHeight - el.clientHeight,
          deltaW: el.scrollWidth - el.clientWidth
        });
      }
    });

    // Detect overlapping bounding boxes among visible elements
    const visible = elements.filter((e) => e.exists).slice(0, 8);
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const a = document.querySelector(visible[i].selector);
        const b = document.querySelector(visible[j].selector);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const overlap =
          ra.left < rb.right &&
          ra.right > rb.left &&
          ra.top < rb.bottom &&
          ra.bottom > rb.top;
        if (overlap && ra.width > 0 && rb.width > 0) {
          overlaps.push({ a: visible[i].selector, b: visible[j].selector });
        }
      }
    }

    return { elements, overflow, overlaps };
  }, section.selectors || []);
}

async function fetchSectionPlaywright(page, section, viewport) {
  const t0 = Date.now();
  const network = [];

  page.on('response', (res) => {
    const req = res.request();
    if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
      network.push({
        url: res.url(),
        status: res.status(),
        timingMs: res.request().timing()?.responseEnd || null
      });
    }
  });

  if (section.isAdmin) {
    await page.goto(`${config.SITE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
  } else if (section.legacy) {
    await page.goto(`${config.SITE_URL}/vault`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
  } else if (section.page && section.page !== '/') {
    await page.goto(`${config.SITE_URL}${section.page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('[data-testid], .gv-vault-shell, .gv-landing', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    await bootstrapVault(page, viewport);
    await navigateSection(page, section, viewport);
  }

  const dom = await captureDomMetrics(page, section);
  let screenshot = null;
  try {
    const buf = await page.screenshot({ fullPage: false });
    const saved = qaStore.saveScreenshot(`crawl-${section.id}-${viewport}-${Date.now()}.png`, buf);
    screenshot = saved.filename;
  } catch {
    /* optional */
  }

  const cssSnapshot = await page.evaluate(() => {
    const sheets = [];
    Array.from(document.styleSheets).slice(0, 12).forEach((ss) => {
      try {
        const rules = ss.cssRules ? Array.from(ss.cssRules).slice(0, 40).map((r) => r.cssText) : [];
        sheets.push({ href: ss.href || 'inline', rules: rules.join('\n').slice(0, 8000) });
      } catch {
        /* cross-origin */
      }
    });
    return sheets;
  });

  return {
    sectionId: section.id,
    label: section.label,
    page: section.page || '/',
    viewport,
    url: section.isAdmin ? `${config.SITE_URL}/admin` : `${config.SITE_URL}/`,
    fetchedAt: new Date().toISOString(),
    hydrated: true,
    source: 'playwright',
    htmlLength: null,
    css: cssSnapshot,
    dom,
    screenshot,
    network: network.slice(0, 30),
    timingMs: Date.now() - t0
  };
}

async function fetchHttpBundle(section) {
  const t0 = Date.now();
  const page = section.page || '/';
  let text = '';
  try {
    const result = await fetchSiteBundleText(config.SITE_URL, page);
    text = result;
  } catch {
    try {
      const r = await fetchText(`${config.SITE_URL}${page}`);
      text = r.text;
    } catch {
      text = '';
    }
  }
  return {
    sectionId: section.id,
    page,
    productionHtml: text,
    timingMs: Date.now() - t0,
    network: [{ url: `${config.SITE_URL}${page}`, status: text ? 200 : 0, timingMs: Date.now() - t0 }]
  };
}

/**
 * Phase 1 entry — returns { snapshots, meta }
 */
async function fetchPhase(opts = {}) {
  const playwright = opts.playwright || (await getPlaywright());
  const useBrowser = (opts.browser === true || config.BROWSER_ENABLED) && playwright;
  const snapshots = [];
  const bundles = [];
  const viewports = opts.viewports || ['desktop', 'mobile'];

  // Static local snapshots for every section
  SITE_SECTIONS.filter((s) => !s.apiOnly).forEach((section) => {
    viewports.forEach((vp) => {
      snapshots.push(buildStaticSnapshot(section, vp));
    });
  });

  // Production HTML bundles
  if (config.SCAN_PRODUCTION !== false) {
    for (const section of SITE_SECTIONS.filter((s) => !s.apiOnly && s.page)) {
      bundles.push(await fetchHttpBundle(section));
    }
  }

  // Playwright hydrated snapshots
  if (useBrowser) {
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: viewport === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
          userAgent:
            viewport === 'mobile'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
              : undefined
        });
        const page = await context.newPage();

        for (const section of SITE_SECTIONS.filter((s) => !s.apiOnly)) {
          try {
            const snap = await fetchSectionPlaywright(page, section, viewport);
            snapshots.push(snap);
          } catch (err) {
            snapshots.push({
              sectionId: section.id,
              viewport,
              page: section.page || '/',
              hydrated: false,
              source: 'playwright-error',
              error: err.message,
              dom: { elements: [], overflow: [], overlaps: [] },
              screenshot: null,
              network: []
            });
          }
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }

  // Local asset CSS snapshot
  const localCss = {};
  LOCAL_ASSETS.filter((a) => a.endsWith('.css')).forEach((rel) => {
    localCss[rel] = readLocalAsset(rel);
  });

  return {
    snapshots,
    bundles,
    localCss,
    meta: {
      at: new Date().toISOString(),
      playwright: !!useBrowser,
      snapshotCount: snapshots.length,
      sections: SITE_SECTIONS.map((s) => s.id)
    }
  };
}

module.exports = {
  fetchPhase,
  buildStaticSnapshot,
  captureDomMetrics,
  getPlaywright,
  MOBILE_VIEWPORT,
  DESKTOP_VIEWPORT
};
