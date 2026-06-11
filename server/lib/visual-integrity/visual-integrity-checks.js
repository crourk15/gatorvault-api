/**
 * Visual integrity QA checks — theme, background, and component variant validation.
 */
const config = require('../qa/qa-config');
const { check, fetchText, moduleResult } = require('../qa/qa-utils');
const engine = require('./visual-integrity-engine');
const mapper = require('./visual-integrity-mapper');

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

async function runVisualIntegrityChecks() {
  const rules = engine.loadRules();
  const { html, teamCss, url } = await fetchPageBundle('/');
  const checks = [];

  checks.push(
    await check(
      'visual-integrity:team-overview-background',
      'visual-integrity',
      'Team Overview background / theme',
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
        if (desktopMissing.length) {
          const err = new Error('Team Overview missing gv-team-overview-layout on desktop');
          err.details = desktopMissing;
          err.repro = 'Desktop Team tab should use gv-team-overview-layout grid';
          err.severity = 'high';
          throw err;
        }
        return { regions: ['vpane-team', 'vpane-mteam'], clean: true };
      }
    )
  );

  checks.push(
    await check(
      'visual-integrity:team-css-linked',
      'visual-integrity',
      'Team module CSS linked',
      async () => {
        const missing = engine.checkCssLinked(html, rules);
        if (missing.length) {
          const err = new Error('gv-team.css not linked on homepage');
          err.details = missing;
          err.repro = 'index.html must include /css/gv-team.css';
          err.severity = 'high';
          throw err;
        }
        return { linked: true };
      }
    )
  );

  checks.push(
    await check(
      'visual-integrity:team-theme-tokens',
      'visual-integrity',
      'Team CSS design tokens',
      async () => {
        const violations = engine.checkCssTokens(teamCss, html, rules);
        if (violations.length) {
          const err = new Error(`${violations.length} team token violation(s)`);
          err.details = violations;
          err.repro = 'Verify --gv-team-* tokens in css/gv-team.css';
          err.severity = 'high';
          throw err;
        }
        return { tokensOk: true };
      }
    )
  );

  checks.push(
    await check(
      'visual-integrity:component-variants',
      'visual-integrity',
      'Component variant validation',
      async () => {
        const violations = engine.checkComponentVariants(html, rules);
        if (violations.length) {
          const err = new Error(`${violations.length} component variant mismatch(es)`);
          err.details = violations.slice(0, 8);
          err.repro = 'Team overview should use gv-team-* cards; Film Room uses verified source hooks';
          err.severity = 'medium';
          throw err;
        }
        return { ok: true };
      }
    )
  );

  checks.push(
    await check(
      'visual-integrity:cross-page-contamination',
      'visual-integrity',
      'Cross-page background contamination',
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
        return { clean: true };
      }
    )
  );

  checks.push(
    await check(
      'visual-integrity:film-room-theme',
      'visual-integrity',
      'Film Room theme isolation',
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
        (cfg?.requiredHooks || []).forEach((hook) => {
          if (!html.includes(hook)) {
            throw new Error(`Film Room hook missing: ${hook}`);
          }
        });
        return { hooks: cfg?.requiredHooks?.length || 0 };
      }
    )
  );

  checks.push(
    await check(
      'visual-integrity:admin-theme',
      'visual-integrity',
      'Admin Hub neutral theme',
      async () => {
        const base = config.SITE_URL.replace(/\/$/, '');
        let adminHtml = '';
        try {
          adminHtml = (await fetchText(`${base}/admin`)).text;
        } catch (e) {
          throw new Error(`Admin page fetch failed: ${e.message}`);
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
      }
    )
  );

  return moduleResult('visual-integrity', checks);
}

module.exports = { runVisualIntegrityChecks };
