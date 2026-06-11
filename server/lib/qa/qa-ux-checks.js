/**
 * UI/UX static checks — tap targets, overflow, modal CSS markers.
 */
const config = require('./qa-config');
const { check, fetchSiteBundleText, moduleResult } = require('./qa-utils');

async function runUxChecks() {
  const checks = [];
  const text = await fetchSiteBundleText(config.SITE_URL, '/');

  checks.push(
    await check('ux:modal-zindex', 'ux', 'Modal z-index stacking', async () => {
      const teamZ = text.match(/#gv-team-detail-modal[^}]*z-index:\s*(\d+)/);
      const verifiedZ = text.includes('gv-verified-source-ov') && text.includes('100010');
      const highlightZ = text.includes('highlight-modal-ov') && text.includes('99999');
      if (!highlightZ) throw new Error('highlight-modal-ov z-index not found');
      if (!verifiedZ) throw new Error('verified source modal z-index (100010) not found');
      if (teamZ && parseInt(teamZ[1], 10) < 99999) {
        throw new Error(`Team modal z-index ${teamZ[1]} may be behind vault overlay`);
      }
      return { highlightZ: true, verifiedZ: true, teamZ: teamZ ? teamZ[1] : 'inline' };
    })
  );

  checks.push(
    await check('ux:tap-targets', 'ux', 'Mobile tap target CSS', async () => {
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
    await check('ux:scroll-containers', 'ux', 'Horizontal scroll containers', async () => {
      const required = ['gv-hscroll-track', '-webkit-overflow-scrolling:touch', 'overflow-x:auto'];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) throw new Error(`Scroll container CSS missing: ${missing.join(', ')}`);
      return { ok: true };
    })
  );

  checks.push(
    await check('ux:overflow-visible', 'ux', 'Modal preview overflow', async () => {
      if (!text.includes('highlight-modal-preview') || !text.includes('overflow:visible')) {
        throw new Error('highlight-modal-preview may clip verified source links');
      }
      return { ok: true };
    })
  );

  checks.push(
    await check('ux:mobile-safari', 'ux', 'Mobile Safari safe-area / viewport', async () => {
      const required = ['viewport', 'safe-area-inset', 'env(safe-area-inset'];
      const hit = required.filter((k) => text.includes(k));
      if (hit.length < 2) throw new Error('Mobile Safari safe-area/viewport meta incomplete');
      return { matched: hit.length };
    })
  );

  return moduleResult('ux', checks);
}

module.exports = { runUxChecks };
