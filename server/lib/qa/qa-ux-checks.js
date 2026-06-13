/**
 * UI/UX static checks — React vault scroll, modals, tap targets, safe-area.
 */
const config = require('./qa-config');
const { check, fetchSiteBundleText, moduleResult } = require('./qa-utils');

const VAULT_PAGES = ['/vault/live-feed', '/vault/team', '/vault/recruiting', '/vault/film-room'];

async function bundleFor(path) {
  return fetchSiteBundleText(config.SITE_URL, path);
}

async function runUxChecks() {
  const checks = [];

  checks.push(
    await check('ux:modal-zindex', 'ux', 'Modal / overlay z-index in React CSS', async () => {
      let text = '';
      for (const p of VAULT_PAGES) {
        text += await bundleFor(p);
      }
      const hasVaultShell = text.includes('gv-vault-shell');
      const hasStickyHeader = text.includes('z-index') && text.includes('gv-vault-shell__header');
      if (!hasVaultShell) {
        throw new Error('VaultShell CSS not found in production bundles');
      }
      if (!hasStickyHeader && !text.includes('z-index: 40') && !text.includes('z-index:40')) {
        throw new Error('Vault header z-index stacking not found — modals may render behind shell');
      }
      return { vaultShell: true, stickyHeader: hasStickyHeader };
    })
  );

  checks.push(
    await check('ux:tap-targets', 'ux', 'Mobile tap target CSS', async () => {
      const text = await bundleFor('/vault');
      const patterns = ['min-height:44px', 'min-h-[44px]', 'touch-action:manipulation', '-webkit-tap-highlight-color'];
      const missing = patterns.filter((p) => !text.includes(p));
      if (missing.length > 2) {
        const err = new Error(`Mobile tap target patterns missing: ${missing.join(', ')}`);
        err.details = { missing };
        throw err;
      }
      return { patternsChecked: patterns.length };
    })
  );

  checks.push(
    await check('ux:scroll-containers', 'ux', 'Scroll containers (hub tabs + live feed)', async () => {
      const text = (await bundleFor('/vault/recruiting')) + (await bundleFor('/vault/live-feed'));
      const required = ['overflow-x:auto', 'overflow-x: auto', '-webkit-overflow-scrolling', 'gv-hub-tabs--scroll'];
      const hit = required.filter((k) => text.includes(k));
      if (hit.length < 2) {
        throw new Error(`Scroll container CSS missing — need hub tab scroll + overflow rules (${hit.length}/${required.length})`);
      }
      return { matched: hit.length };
    })
  );

  checks.push(
    await check('ux:live-feed-layout', 'ux', 'Live Feed ESPN layout markers', async () => {
      const text = await bundleFor('/vault/live-feed');
      const required = [
        'gv-live-ticker',
        'gv-live-feed__tabs',
        'gv-live-feed__row',
        'gv-live-feed__row-time'
      ];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        throw new Error(`Live Feed layout CSS missing: ${missing.join(', ')}`);
      }
      return { ok: true };
    })
  );

  checks.push(
    await check('ux:mobile-safari', 'ux', 'Mobile Safari safe-area / viewport', async () => {
      const text = await bundleFor('/vault');
      const required = ['viewport', 'safe-area-inset', 'env(safe-area-inset'];
      const hit = required.filter((k) => text.includes(k));
      if (hit.length < 2) {
        throw new Error('Mobile Safari safe-area/viewport meta incomplete in vault bundle');
      }
      return { matched: hit.length };
    })
  );

  checks.push(
    await check('ux:bottom-nav', 'ux', 'React mobile bottom nav', async () => {
      const text = await bundleFor('/vault');
      const required = ['gv-vault-bottom-nav', 'gv-vault-bottom-nav__item'];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        throw new Error(`React bottom nav CSS missing: ${missing.join(', ')}`);
      }
      return { ok: true };
    })
  );

  return moduleResult('ux', checks);
}

module.exports = { runUxChecks };
