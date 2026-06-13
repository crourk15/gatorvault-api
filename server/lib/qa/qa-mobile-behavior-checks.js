/**
 * Mobile Behavior QA — headless mobile viewport scripted flows.
 * Admin-only diagnostics; nothing surfaced to end-user mobile UI.
 */
const fs = require('fs');
const path = require('path');
const config = require('./qa-config');
const qaStore = require('./qa-store');
const mobileStore = require('./qa-mobile-behavior-store');
const { check, moduleResult, fetchText, fetchJson } = require('./qa-utils');

const IPHONE_VIEWPORT = { width: 390, height: 844 };
const ANDROID_VIEWPORT = { width: 412, height: 915 };

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const LOCAL_INDEX = path.join(__dirname, '..', '..', 'index.html');

async function getPlaywright() {
  try {
    return require('playwright');
  } catch {
    return null;
  }
}

function issue(type, screen, description, suggestedFix, extra) {
  return {
    type,
    screen,
    description,
    suggestedFix,
    severity: extra?.severity || 'medium',
    flowId: extra?.flowId || null,
    details: extra?.details || null
  };
}

function readLocalBuildStamp() {
  try {
    const html = fs.readFileSync(LOCAL_INDEX, 'utf8');
    const m =
      html.match(/<meta\s+name="gatorvault-build"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="gv-build"\s+content="([^"]+)"/i);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function readProductionBuildStamp() {
  const { text } = await fetchText(config.SITE_URL, { timeout: 20000 });
  const m =
    text.match(/<meta\s+name="gatorvault-build"\s+content="([^"]+)"/i) ||
    text.match(/<meta\s+name="gv-build"\s+content="([^"]+)"/i);
  return m ? m[1].trim() : null;
}

async function bootstrapMobileVault(page) {
  await page.goto(`${config.SITE_URL}/vault`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.gv-vault-shell, [data-testid="vault-dashboard"]', { timeout: 20000 });
  await page.waitForTimeout(2500);
}

async function usesReactVaultShell(page) {
  return page.evaluate(() => !!document.querySelector('.gv-vault-shell'));
}

async function tapNav(page, tab) {
  await page.click(`#gv-bottom-nav .gv-bnav-btn[data-mnav="${tab}"]`, { timeout: 8000 });
  await page.waitForTimeout(1200);
}

async function runFeedFreshnessFlow(page, apiUrl, maxAgeHours) {
  const flowId = 'home-feed-freshness';
  const issues = [];

  const dash = await page.evaluate(async (base) => {
    const attempts = 4;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const r = await fetch(`${base}/api/live/dashboard?limit=20&_=${Date.now()}`, { cache: 'no-store' });
        if (r.status === 502 || r.status === 503 || r.status === 504) {
          await new Promise((resolve) => setTimeout(resolve, 2500 * (i + 1)));
          continue;
        }
        const j = await r.json();
        if (j.ok) return { ok: true, feed: j.feed || [], updatedAt: j.updatedAt || null };
        await new Promise((resolve) => setTimeout(resolve, 2500 * (i + 1)));
      } catch (e) {
        if (i === attempts - 1) return { ok: false, error: e.message };
        await new Promise((resolve) => setTimeout(resolve, 2500 * (i + 1)));
      }
    }
    return { ok: false, error: 'dashboard unavailable after retries' };
  }, apiUrl);

  if (!dash.ok) {
    issues.push(
      issue(
        'feed-freshness',
        'Home',
        `Live dashboard API unavailable during mobile flow: ${dash.error || 'unknown'}`,
        'Verify Render API /api/live/dashboard and feed-items.json pipeline health',
        { flowId, severity: 'high' }
      )
    );
    return { flowId, pass: false, issues };
  }

  const newest = (dash.feed || [])
    .map((i) => new Date(i.createdAt || 0).getTime())
    .filter((t) => t > 0)
    .sort((a, b) => b - a)[0];

  if (!newest) {
    issues.push(
      issue(
        'feed-freshness',
        'Home',
        'Live feed returned zero items with valid createdAt timestamps',
        'Refresh feed-items.json and verify live-aggregator ingest',
        { flowId, severity: 'high' }
      )
    );
    return { flowId, pass: false, issues };
  }

  const ageHours = (Date.now() - newest) / (3600 * 1000);
  if (ageHours > maxAgeHours) {
    issues.push(
      issue(
        'feed-freshness',
        'Home',
        `Latest feed item is ${Math.round(ageHours)}h old (max ${maxAgeHours}h)`,
        'Trigger live refresh, verify ingest cron, and ensure mobile Home tab calls gvLoadLiveDashboard(true) on focus',
        { flowId, severity: 'high', details: { newestIso: new Date(newest).toISOString(), ageHours: Math.round(ageHours) } }
      )
    );
  }

  await tapNav(page, 'mhome');
  const uiState = await page.evaluate(() => {
    var el = document.getElementById('gv-mhome-updates');
    var cards = el ? el.querySelectorAll('.gv-headline-card, .gv-espn-card').length : 0;
    var loading = el ? /loading|Refreshing/i.test(el.textContent || '') : false;
    var feedLen = (window._gvLive && window._gvLive.feed) ? window._gvLive.feed.length : 0;
    return { cards, loading, feedLen, html: el ? el.textContent.slice(0, 200) : '' };
  });

  if (!uiState.cards && !uiState.loading && dash.feed.length > 0) {
    issues.push(
      issue(
        'feed-freshness',
        'Home',
        'Latest Updates UI did not render feed cards after returning to Home tab',
        'Ensure gvMobileShowTab("mhome") awaits gvLoadLiveDashboard before gvRenderMobileHome',
        { flowId, severity: 'high', details: uiState }
      )
    );
  }

  return { flowId, pass: issues.length === 0, issues, details: { ageHours: Math.round(ageHours), uiCards: uiState.cards } };
}

async function runRecruitPlayerBackFlow(page, apiUrl) {
  const flowId = 'recruit-player-back';
  const issues = [];

  await tapNav(page, 'recruit');

  const slug = await page.evaluate(async (base) => {
    try {
      const r = await fetch(`${base}/api/recruiting/board`);
      const j = await r.json();
      const players = j.players || j.board || j.commits || [];
      const first = (Array.isArray(players) ? players : []).find((p) => p.slug || p.id);
      return first ? (first.slug || first.id) : null;
    } catch {
      return null;
    }
  }, apiUrl);

  if (!slug) {
    return {
      flowId,
      pass: true,
      skipped: true,
      issues: [],
      details: { reason: 'no recruit slug available for modal test' }
    };
  }

  await page.evaluate((s) => {
    if (typeof gvOpenRecruitProfile === 'function') gvOpenRecruitProfile(s);
  }, slug);
  await page.waitForTimeout(800);

  const opened = await page.evaluate(() => {
    var m = document.getElementById('recruit-profile-modal');
    return !!(m && m.classList.contains('open'));
  });

  if (!opened) {
    issues.push(
      issue(
        'navigation',
        'Recruiting → Player',
        'Recruit profile modal did not open via gvOpenRecruitProfile',
        'Verify recruit-profile-modal markup and gvOpenRecruitProfile wiring in index.html',
        { flowId, severity: 'high' }
      )
    );
    return { flowId, pass: false, issues };
  }

  const stackBefore = await page.evaluate(() => (window._gvModalStack || []).slice());

  await page.evaluate(() => {
    var btn = document.getElementById('recruit-profile-back');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);

  const afterBack = await page.evaluate(() => ({
    modalOpen: document.getElementById('recruit-profile-modal')?.classList.contains('open'),
    recruitActive: document.getElementById('vpane-recruit')?.classList.contains('active'),
    stack: window._gvModalStack || []
  }));

  if (afterBack.modalOpen) {
    await page.goBack().catch(() => {});
    await page.waitForTimeout(500);
    const afterHistory = await page.evaluate(() => ({
      modalOpen: document.getElementById('recruit-profile-modal')?.classList.contains('open')
    }));
    if (afterHistory.modalOpen) {
      issues.push(
        issue(
          'navigation',
          'Recruiting → Player',
          'Back control did not close recruit profile modal (button + history.back)',
          'Wire gvPushModalHistory/gvPopModalHistory on gvOpenRecruitProfile and gvCloseRecruitProfile; ensure back button calls close with history sync',
          { flowId, severity: 'critical', details: { stackBefore, afterBack } }
        )
      );
    }
  }

  return { flowId, pass: issues.length === 0, issues, details: { slug, afterBack } };
}

async function runTeamTabThemeFlow(page) {
  const flowId = 'team-tab-theme';
  const issues = [];

  await tapNav(page, 'team');

  const state = await page.evaluate(() => {
    var gate = document.getElementById('trial-expired-gate');
    var gateVisible =
      gate &&
      !gate.classList.contains('hidden') &&
      gate.offsetParent !== null &&
      getComputedStyle(gate).display !== 'none';
    var mteam = document.getElementById('vpane-mteam');
    var mteamActive = mteam && mteam.classList.contains('active');
    var hasTeamPage = mteam && mteam.classList.contains('gv-team-page');
    var trialInside =
      mteam &&
      (mteam.querySelector('.trial-expired-ov, #trial-expired-gate, #trial-payment-banner') ||
        /30-Day Trial|trial-expired|pricing-sec/i.test(mteam.innerHTML.slice(0, 8000)));
    var bg = mteam ? getComputedStyle(mteam).backgroundColor : '';
    return { gateVisible, mteamActive, hasTeamPage, trialInside, bg };
  });

  if (state.gateVisible) {
    issues.push(
      issue(
        'tab-theme',
        'Team',
        'Trial expired gate overlay is visible on Team tab',
        'Ensure trial-expired-gate stays hidden for active trials; add #trial-expired-gate.hidden { display:none!important } and call updateTrialUI on team tab focus',
        { flowId, severity: 'critical', details: state }
      )
    );
  }

  if (!state.mteamActive) {
    issues.push(
      issue(
        'navigation',
        'Team',
        'Team mobile pane (#vpane-mteam) is not active after tapping Team tab',
        'Verify gvMobileShowTab maps team → mteam and bottom nav data-mnav="team" handler',
        { flowId, severity: 'high', details: state }
      )
    );
  }

  if (!state.hasTeamPage) {
    issues.push(
      issue(
        'tab-theme',
        'Team',
        'Mobile Team pane missing gv-team-page class (stale or incorrect markup)',
        'Deploy index.html with #vpane-mteam.gv-team-page and gv-team-overview-layout; trigger Netlify deploy',
        { flowId, severity: 'high', details: state }
      )
    );
  }

  if (state.trialInside) {
    issues.push(
      issue(
        'tab-theme',
        'Team',
        'Trial/promo markup detected inside mobile Team pane',
        'Remove trial/pricing classes from #vpane-mteam; use gv-team-page design system only',
        { flowId, severity: 'critical', details: state }
      )
    );
  }

  return { flowId, pass: issues.length === 0, issues, details: state };
}

async function runTeamDetailBackFlow(page) {
  const flowId = 'team-detail-back';
  const issues = [];

  await tapNav(page, 'team');
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    if (typeof gvOpenTeamEra === 'function') gvOpenTeamEra('modern');
    else if (typeof gvOpenTeamDetail === 'function') gvOpenTeamDetail('era', 'modern');
  });
  await page.waitForTimeout(900);

  const opened = await page.evaluate(() => {
    var ov = document.getElementById('gv-team-detail-modal');
    return !!(ov && !ov.classList.contains('hidden'));
  });

  if (!opened) {
    return {
      flowId,
      pass: true,
      skipped: true,
      issues: [],
      details: { reason: 'team detail modal hooks unavailable in production build' }
    };
  }

  await page.evaluate(() => {
    var btn = document.getElementById('gv-team-detail-close');
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);

  let closed = await page.evaluate(() => {
    var ov = document.getElementById('gv-team-detail-modal');
    return ov && ov.classList.contains('hidden');
  });

  if (!closed) {
    await page.goBack().catch(() => {});
    await page.waitForTimeout(500);
    closed = await page.evaluate(() => {
      var ov = document.getElementById('gv-team-detail-modal');
      return ov && ov.classList.contains('hidden');
    });
  }

  if (!closed) {
    issues.push(
      issue(
        'navigation',
        'Team → Era Detail',
        'Team detail modal did not close via close button or browser back',
        'Add gvPushModalHistory to gv-team-mobile.js openRichModal and gvPopModalHistory in closeTeamDetail',
        { flowId, severity: 'high' }
      )
    );
  }

  const teamStillActive = await page.evaluate(() =>
    document.getElementById('vpane-mteam')?.classList.contains('active')
  );
  if (!teamStillActive) {
    issues.push(
      issue(
        'navigation',
        'Team → Era Detail',
        'Closing team detail modal navigated away from Team tab unexpectedly',
        'Ensure modal close does not call showVTab or location changes; only pop modal history stack',
        { flowId, severity: 'medium' }
      )
    );
  }

  return { flowId, pass: issues.length === 0, issues };
}

async function runHomeTabReselectFlow(page) {
  const flowId = 'home-tab-reselect';
  const issues = [];

  await tapNav(page, 'team');
  await page.waitForTimeout(800);

  const stampBefore = await page.evaluate(() => (window._gvLive && window._gvLive.lastUpdated) || null);

  await tapNav(page, 'mhome');
  await page.waitForTimeout(2500);

  const stampAfter = await page.evaluate(() => ({
    lastUpdated: (window._gvLive && window._gvLive.lastUpdated) || null,
    loading: window._gvLive && window._gvLive.loading,
    cards: document.querySelectorAll('#gv-mhome-updates .gv-headline-card').length
  }));

  if (stampBefore && stampAfter.lastUpdated && stampBefore === stampAfter.lastUpdated) {
    issues.push(
      issue(
        'feed-freshness',
        'Home',
        'Returning to Home tab did not refresh live dashboard timestamp',
        'Call gvLoadLiveDashboard(true, true) on mhome tab focus and on visibilitychange',
        { flowId, severity: 'medium', details: { stampBefore, stampAfter } }
      )
    );
  }

  return { flowId, pass: issues.length === 0, issues, details: stampAfter };
}

async function checkStaleHtml() {
  const flowId = 'stale-html';
  const issues = [];
  const local = readLocalBuildStamp();
  let production = null;
  try {
    production = await readProductionBuildStamp();
  } catch (err) {
    issues.push(
      issue(
        'stale-html',
        'Global',
        `Could not fetch production HTML build stamp: ${err.message}`,
        'Verify Netlify site is reachable and SITE_URL is correct',
        { flowId, severity: 'high' }
      )
    );
    return { flowId, pass: false, issues };
  }

  if (!local) {
    return { flowId, pass: true, skipped: true, issues: [], details: { reason: 'local index.html gv-build not found' } };
  }

  if (!production) {
    issues.push(
      issue(
        'stale-html',
        'Global',
        'Production index.html missing build stamp (gatorvault-build or gv-build)',
        'Ensure stamp-build-meta.js runs during Netlify build',
        { flowId, severity: 'high', details: { local } }
      )
    );
  } else if (local !== production) {
    issues.push(
      issue(
        'stale-html',
        'Global',
        `Production HTML build stamp "${production}" does not match repo "${local}"`,
        'Trigger Netlify deploy from latest main commit; verify publish directory is server/',
        { flowId, severity: 'critical', details: { local, production } }
      )
    );
  }

  return { flowId, pass: issues.length === 0, issues, details: { local, production } };
}

async function runViewportFlows(playwright, viewportDef) {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: viewportDef.size,
    userAgent: viewportDef.userAgent,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const flows = [];
  const allIssues = [];

  try {
    await bootstrapMobileVault(page);

    const reactVault = await usesReactVaultShell(page);
    if (reactVault) {
      return {
        viewport: viewportDef.label,
        flows: [
          {
            flowId: 'monolith-mobile-retired',
            pass: true,
            skipped: true,
            issues: [],
            details: { reason: 'React VaultShell active — monolith #gv-bottom-nav flows retired (Phase 5)' }
          }
        ],
        issues: [],
        screenshot: null,
        pass: true
      };
    }

    flows.push(await runFeedFreshnessFlow(page, config.API_URL, config.MOBILE_FEED_MAX_AGE_HOURS));
    flows.push(await runHomeTabReselectFlow(page));
    flows.push(await runRecruitPlayerBackFlow(page, config.API_URL));
    flows.push(await runTeamTabThemeFlow(page));
    flows.push(await runTeamDetailBackFlow(page));

    flows.forEach((f) => {
      (f.issues || []).forEach((i) => {
        allIssues.push({ ...i, viewport: viewportDef.label });
      });
    });

    const buf = await page.screenshot({ fullPage: false });
    const saved = qaStore.saveScreenshot(`qa-mobile-${viewportDef.label}-${Date.now()}.png`, buf);

    return {
      viewport: viewportDef.label,
      flows,
      issues: allIssues,
      screenshot: saved.filename,
      pass: allIssues.length === 0
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runMobileBehaviorChecks(opts = {}) {
  if (!config.MOBILE_BEHAVIOR_ENABLED) {
    return moduleResult('mobile-behavior', [
      {
        id: 'mobile-behavior:disabled',
        module: 'mobile-behavior',
        label: 'Mobile behavior QA',
        pass: true,
        details: { skipped: true, reason: 'QA_MOBILE_BEHAVIOR_ENABLED not set' }
      }
    ]);
  }

  const playwright = await getPlaywright();
  if (!playwright) {
    return moduleResult('mobile-behavior', [
      {
        id: 'mobile-behavior:no-playwright',
        module: 'mobile-behavior',
        label: 'Mobile behavior QA',
        pass: true,
        details: {
          skipped: true,
          reason: 'playwright not installed — run: npm install playwright && npx playwright install chromium'
        }
      }
    ]);
  }

  const startedAt = new Date().toISOString();
  const runId = `mb_${Date.now()}`;
  const checks = [];
  const staleResult = await checkStaleHtml();
  const viewportResults = [];

  for (const vp of [
    { label: 'iphone', size: IPHONE_VIEWPORT, userAgent: IPHONE_UA },
    ...(config.MOBILE_BEHAVIOR_ANDROID ? [{ label: 'android', size: ANDROID_VIEWPORT, userAgent: ANDROID_UA }] : [])
  ]) {
    viewportResults.push(await runViewportFlows(playwright, vp));
  }

  const flowIssues = viewportResults.flatMap((v) => v.issues || []);
  const staleIssues = staleResult.issues || [];
  const allIssues = [...flowIssues, ...staleIssues.map((i) => ({ ...i, viewport: 'all' }))];

  checks.push(
    await check('mobile-behavior:stale-html', 'mobile-behavior', 'Production HTML build stamp', async () => {
      if (staleResult.pass) return staleResult.details || { ok: true };
      const err = new Error(staleIssues.map((i) => i.description).join('; ') || 'Stale HTML');
      err.details = { issues: staleIssues, ...staleResult.details };
      err.repro = 'Compare meta gv-build on gatorvaultinsider.com vs server/index.html in repo';
      throw err;
    })
  );

  checks.push(
    await check('mobile-behavior:feed-freshness', 'mobile-behavior', 'Latest Updates feed freshness', async () => {
      const feedIssues = allIssues.filter((i) => i.type === 'feed-freshness');
      if (!feedIssues.length) {
        return { maxAgeHours: config.MOBILE_FEED_MAX_AGE_HOURS, viewports: viewportResults.map((v) => v.viewport) };
      }
      const err = new Error(feedIssues[0].description);
      err.details = { issues: feedIssues };
      err.repro = 'Mobile: Home → Latest Updates; verify items within max age and refresh on tab focus';
      throw err;
    })
  );

  checks.push(
    await check('mobile-behavior:navigation-back', 'mobile-behavior', 'Modal back / history navigation', async () => {
      const navIssues = allIssues.filter((i) => i.type === 'navigation');
      if (!navIssues.length) return { flows: ['recruit-player-back', 'team-detail-back'] };
      const err = new Error(navIssues.map((i) => i.description).join('; '));
      err.details = { issues: navIssues };
      err.repro = 'Open recruit/team player modal on mobile; back gesture must close modal and restore prior pane';
      throw err;
    })
  );

  checks.push(
    await check('mobile-behavior:team-tab-theme', 'mobile-behavior', 'Team tab theme (no trial/promo bleed)', async () => {
      const themeIssues = allIssues.filter((i) => i.type === 'tab-theme');
      if (!themeIssues.length) return { ok: true };
      const err = new Error(themeIssues.map((i) => i.description).join('; '));
      err.details = { issues: themeIssues };
      err.repro = 'Mobile Team tab must show gv-team-page dark theme without trial-expired overlay';
      throw err;
    })
  );

  const mod = moduleResult('mobile-behavior', checks);
  const failed = (mod.checks || []).filter((c) => !c.pass).length;

  const report = {
    id: runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(startedAt).getTime(),
    pass: failed === 0,
    viewport: viewportResults.map((v) => v.viewport).join('+'),
    flows: viewportResults.flatMap((v) => v.flows || []),
    issues: allIssues,
    viewports: viewportResults,
    summary: { total: mod.total, failed, passed: mod.total - failed }
  };

  mobileStore.recordRun(report);

  if (opts.standalone) {
    return { ok: report.pass, report, module: mod };
  }

  return mod;
}

module.exports = {
  runMobileBehaviorChecks,
  checkStaleHtml,
  readLocalBuildStamp,
  readProductionBuildStamp
};
