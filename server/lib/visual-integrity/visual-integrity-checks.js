/**
 * Visual integrity QA checks — React vault theme and layout validation.
 */
const fs = require('fs');
const path = require('path');
const config = require('../qa/qa-config');
const { check, fetchText, fetchSiteBundleText, moduleResult } = require('../qa/qa-utils');
const engine = require('./visual-integrity-engine');
const mapper = require('./visual-integrity-mapper');

const SERVER_ROOT = path.join(__dirname, '..', '..');

const REACT_VAULT_ROUTES = [
  { path: '/vault', label: 'Vault Dashboard', testid: 'vault-dashboard' },
  { path: '/vault/team', label: 'Team', testid: 'vault-team' },
  { path: '/vault/film-room', label: 'Film Room', testid: 'vault-film-room' },
  { path: '/vault/recruiting', label: 'Recruiting Hub', testid: 'vault-recruiting-hub' },
  { path: '/vault/live-feed', label: 'Live Feed', testid: 'vault-live-feed' }
];

function loadLocalVaultHtml(routePath) {
  const rel = routePath === '/' ? 'index.html' : `${routePath.replace(/^\//, '')}/index.html`;
  const filePath = path.join(SERVER_ROOT, rel);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function fetchPageBundle(pagePath) {
  const base = config.SITE_URL.replace(/\/$/, '');
  const pathNorm = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const text = await fetchSiteBundleText(base, pathNorm);
  return { html: text, teamCss: '', url: `${base}${pathNorm}` };
}

function loadLocalPageBundle(routePath) {
  const html = loadLocalVaultHtml(routePath);
  let vaultCss = '';
  try {
    vaultCss = fs.readFileSync(path.join(SERVER_ROOT, '..', 'client', 'lib', 'vault-shell.css'), 'utf8');
  } catch {
    /* optional */
  }
  return { html, teamCss: vaultCss, url: `local:server${routePath}/index.html` };
}

async function runVisualIntegrityChecks(opts = {}) {
  const rules = engine.loadRules();
  const useLocal = opts.local !== false;
  const checks = [];

  async function runCheck(id, label, fn) {
    return check(id, 'visual-integrity', label, fn);
  }

  for (const route of REACT_VAULT_ROUTES) {
    const bundles = [];
    if (useLocal) {
      bundles.push({ ...loadLocalPageBundle(route.path), source: 'local' });
    }
    try {
      bundles.push({ ...(await fetchPageBundle(route.path)), source: 'production' });
    } catch {
      if (!bundles.length) {
        checks.push(
          await runCheck(
            `visual-integrity:${route.testid}:unreachable`,
            `${route.label} production fetch`,
            async () => {
              throw new Error(`Could not fetch ${route.path} from production`);
            }
          )
        );
        continue;
      }
    }

    for (const bundle of bundles) {
      const { html, url, source } = bundle;
      const suffix = source === 'local' ? '' : ` (${source})`;

      checks.push(
        await runCheck(
          source === 'local'
            ? `visual-integrity:${route.testid}:markers`
            : `visual-integrity:${route.testid}:markers:${source}`,
          `${route.label} React markers${suffix}`,
          async () => {
            if (!html.includes(route.testid) && !html.includes('gv-vault-shell')) {
              const err = new Error(`${route.label} missing data-testid="${route.testid}"`);
              err.url = url;
              err.repro = `Rebuild and deploy ${route.path} React export`;
              throw err;
            }
            const monolithHits = ['vpane-start', 'gvOpenTeamDetail', 'openHighlightPlayer', 'film-room-hub-landing'].filter(
              (m) => html.includes(m)
            );
            if (monolithHits.length) {
              const err = new Error(`${route.label} contains retired monolith hooks: ${monolithHits.join(', ')}`);
              err.url = url;
              err.severity = 'critical';
              throw err;
            }
            return { route: route.path, clean: true, source };
          }
        )
      );
    }
  }

  checks.push(
    await runCheck('visual-integrity:vault-shell-theme', 'VaultShell theme tokens', async () => {
      const text = loadLocalVaultHtml('/vault') + loadLocalPageBundle('/vault/team').teamCss;
      const required = ['gv-vault-shell', 'gv-page-title', 'gv-hub-tab'];
      const missing = required.filter((t) => !text.includes(t));
      if (missing.length) {
        const err = new Error(`Vault shell CSS tokens missing: ${missing.join(', ')}`);
        err.repro = 'Verify client/lib/vault-shell.css is bundled with vault pages';
        throw err;
      }
      return { ok: true };
    })
  );

  checks.push(
    await runCheck('visual-integrity:live-feed-layout', 'Live Feed visual layout', async () => {
      const html = useLocal ? loadLocalVaultHtml('/vault/live-feed') : (await fetchPageBundle('/vault/live-feed')).html;
      const required = ['gv-live-ticker', 'gv-live-feed__tabs', 'gv-live-feed__row'];
      const missing = required.filter((t) => !html.includes(t));
      if (missing.length) {
        const err = new Error(`Live Feed layout classes missing: ${missing.join(', ')}`);
        throw err;
      }
      return { ok: true };
    })
  );

  checks.push(
    await runCheck('visual-integrity:landing-page', 'React landing page', async () => {
      let html = loadLocalPageBundle('/').html || loadLocalVaultHtml('/');
      if (!html.includes('landing-page')) {
        try {
          html = (await fetchPageBundle('/')).html;
        } catch {
          /* use local */
        }
      }
      if (!html.includes('landing-page') && !html.includes('data-testid="landing-page"')) {
        const err = new Error('React landing page marker missing from /');
        err.repro = 'index.html must be React marketing landing, not monolith vault overlay';
        throw err;
      }
      if (html.includes('vpane-start')) {
        const err = new Error('Monolith vpane hooks found on landing page');
        throw err;
      }
      return { reactLanding: true };
    })
  );

  return moduleResult('visual-integrity', checks);
}

module.exports = { runVisualIntegrityChecks };
