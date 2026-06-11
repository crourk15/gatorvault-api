/**
 * Visual integrity QA checks — theme, background, and component variant validation.
 */
const fs = require('fs');
const path = require('path');
const config = require('../qa/qa-config');
const { check, fetchText, moduleResult } = require('../qa/qa-utils');
const engine = require('./visual-integrity-engine');
const mapper = require('./visual-integrity-mapper');

const SERVER_ROOT = path.join(__dirname, '..', '..');

async function fetchPageBundle(pagePath) {
  const base = config.SITE_URL.replace(/\/$/, '');
  const pathNorm = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const { text: html } = await fetchText(`${base}${pathNorm}`);
  let teamCss = '';
  try {
    teamCss = (await fetchText(`${base}/css/gv-team.css`)).text;
  } catch {
    /* optional */
  }
  return { html, teamCss, url: `${base}${pathNorm}` };
}

function loadLocalPageBundle() {
  const html = fs.readFileSync(path.join(SERVER_ROOT, 'index.html'), 'utf8');
  let teamCss = '';
  try {
    teamCss = fs.readFileSync(path.join(SERVER_ROOT, 'css', 'gv-team.css'), 'utf8');
  } catch {
    /* optional */
  }
  return { html, teamCss, url: 'local:server/index.html' };
}

async function runVisualIntegrityChecks(opts = {}) {
  const rules = engine.loadRules();
  const useLocal = opts.local !== false;
  const bundles = [];

  if (useLocal) {
    bundles.push({ ...loadLocalPageBundle(), source: 'local' });
  }
  try {
    bundles.push({ ...(await fetchPageBundle('/')), source: 'production' });
  } catch (e) {
    if (!bundles.length) throw e;
  }

  const checks = [];

  async function runCheck(id, label, fn) {
    return check(id, 'visual-integrity', label, fn);
  }

  for (const bundle of bundles) {
    const { html, teamCss, url, source } = bundle;
    const suffix = source === 'local' ? '' : ` (${source})`;

    checks.push(
      await runCheck(
        source === 'local' ? 'visual-integrity:team-overview-background' : `visual-integrity:team-overview-background:${source}`,
        `Team Overview background / theme${suffix}`,
        async () => {
          const violations = engine.checkRegionContamination(html, '/team', rules);
          const bgHits = violations.filter((v) => v.type === 'forbidden_background_class');
          if (bgHits.length) {
            const err = new Error(
              `Team Overview uses contaminated background (${bgHits.map((v) => v.pattern).join(', ')})`
            );
            err.details = bgHits;
            err.url = url;
            err.repro = 'Open Team tab; inspect #vpane-team / #vpane-mteam for trial or pricing classes';
            err.severity = 'high';
            err.suggestedFix = mapper.suggestedFix('visual-integrity:team-overview-background', bgHits);
            throw err;
          }
          const desktopMissing = violations.filter((v) => v.type === 'desktop_layout_missing');
          const requiredMissing = violations.filter((v) => v.type === 'required_class_missing');
          if (desktopMissing.length || requiredMissing.length) {
            const err = new Error('Team Overview layout markers missing on desktop');
            err.details = [...desktopMissing, ...requiredMissing];
            err.repro = 'Desktop Team tab should use gv-team-overview-layout grid';
            err.severity = 'medium';
            throw err;
          }
          return { regions: ['vpane-team', 'vpane-mteam'], clean: true, source };
        }
      )
    );

    if (source === 'local') {
      checks.push(
        await runCheck('visual-integrity:team-css-linked', 'Team module CSS linked', async () => {
          const missing = engine.checkCssLinked(html, rules);
          if (missing.length) {
            const err = new Error('gv-team.css not linked on homepage');
            err.details = missing;
            err.repro = 'index.html must include /css/gv-team.css';
            err.severity = 'high';
            throw err;
          }
          return { linked: true };
        })
      );

      checks.push(
        await runCheck('visual-integrity:team-theme-tokens', 'Team CSS design tokens', async () => {
          const violations = engine.checkCssTokens(teamCss, html, rules);
          if (violations.length) {
            const err = new Error(`${violations.length} team token violation(s)`);
            err.details = violations;
            err.repro = 'Verify --gv-team-* tokens in css/gv-team.css';
            err.severity = 'high';
            throw err;
          }
          return { tokensOk: true };
        })
      );

      checks.push(
        await runCheck('visual-integrity:component-variants', 'Component variant validation', async () => {
          const violations = engine.checkComponentVariants(html, rules);
          if (violations.length) {
            const err = new Error(`${violations.length} component variant mismatch(es)`);
            err.details = violations.slice(0, 8);
            err.repro =
              'Team overview in index.html (#vpane-team, #vpane-mteam): gv-team-page shell, gv-team-overview-layout, gv-team-era-card — no card-h / trial / pricing classes';
            err.severity = 'medium';
            throw err;
          }
          return { ok: true };
        })
      );

      checks.push(
        await runCheck('visual-integrity:panel-clipping', 'Modal panel clipping guards', async () => {
          const violations = engine.checkPanelClippingCss(teamCss);
          if (violations.length) {
            const err = new Error(`${violations.length} panel clipping guard(s) missing in gv-team.css`);
            err.details = violations;
            err.repro = 'Program History modal needs min-height:0, min-width:0, overflow-wrap on text blocks';
            err.severity = 'high';
            throw err;
          }
          return { ok: true };
        })
      );

      checks.push(
        await runCheck('visual-integrity:layout-overflow', 'Layout overflow / scroll CSS', async () => {
          const violations = engine.checkLayoutOverflowCss(teamCss);
          if (violations.length) {
            const err = new Error(`${violations.length} layout overflow issue(s) in team modal CSS`);
            err.details = violations;
            err.repro = 'Desktop modal body must scroll — min-height:0 + overflow-y:auto on .gv-team-modal-body';
            err.severity = 'high';
            throw err;
          }
          return { ok: true };
        })
      );
    }

    checks.push(
      await runCheck(
        source === 'local' ? 'visual-integrity:cross-page-contamination' : `visual-integrity:cross-page-contamination:${source}`,
        `Cross-page background contamination${suffix}`,
        async () => {
          const violations = engine.checkCrossPageContamination(html, rules);
          if (violations.length) {
            const err = new Error(`${violations.length} cross-page theme leak(s)`);
            err.details = violations.slice(0, 6);
            err.url = url;
            err.repro = 'Trial/promo backgrounds must not appear on Team, Film Room, Latest, or Admin';
            err.severity = 'critical';
            throw err;
          }
          return { clean: true, source };
        }
      )
    );

    checks.push(
      await runCheck(
        source === 'local' ? 'visual-integrity:film-room-theme' : `visual-integrity:film-room-theme:${source}`,
        `Film Room theme isolation${suffix}`,
        async () => {
          const cfg = rules.pageRegions?.['/film-room'];
          const violations = engine.checkRegionContamination(html, '/film-room', rules);
          const hits = violations.filter((v) => v.type === 'forbidden_background_class');
          if (hits.length) {
            const err = new Error('Film Room pane contains wrong theme classes');
            err.details = hits;
            err.repro = 'Open Film Room tab; remove trial/team contamination';
            throw err;
          }
          const missingHooks = (cfg?.requiredHooks || []).filter((hook) => !html.includes(hook));
          if (missingHooks.length) {
            const err = new Error(`Film Room hook(s) missing: ${missingHooks.join(', ')}`);
            err.details = missingHooks.map((h) => ({ missingHook: h }));
            throw err;
          }
          if (!html.includes('film-room-hub-landing') && !html.includes('GV_FILM_HUB_DESC')) {
            const err = new Error('Film Room drill-down hub structure missing');
            err.details = [{ issue: 'film_room_hub_missing' }];
            err.repro = 'Film Room needs hub landing cards + GV_FILM_HUB_DESC categories';
            throw err;
          }
          return { hooks: cfg?.requiredHooks?.length || 0, source };
        }
      )
    );
  }

  // Admin theme — production only
  checks.push(
    await runCheck('visual-integrity:admin-theme', 'Admin Hub neutral theme', async () => {
      const base = config.SITE_URL.replace(/\/$/, '');
      let adminHtml = readLocalAdminHtml();
      if (!adminHtml) {
        try {
          adminHtml = (await fetchText(`${base}/admin`)).text;
        } catch (e) {
          throw new Error(`Admin page fetch failed: ${e.message}`);
        }
      }
      const violations = [];
      ['trial-expired-ov', 'gv-team-overview-layout', 'pricing-sec'].forEach((cls) => {
        if (adminHtml.includes(cls)) violations.push({ class: cls });
      });
      if (!adminHtml.includes('admin-hub-core')) {
        violations.push({ missing: 'admin-hub-core' });
      }
      if (violations.length) {
        const err = new Error('Admin Hub theme contamination or missing shell');
        err.details = violations;
        err.repro = 'Load /admin — should use hub-neutral styling only';
        throw err;
      }
      return { ok: true };
    })
  );

  return moduleResult('visual-integrity', checks);
}

function readLocalAdminHtml() {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, 'admin.html'), 'utf8');
  } catch {
    return '';
  }
}

module.exports = { runVisualIntegrityChecks, loadLocalPageBundle, fetchPageBundle };
