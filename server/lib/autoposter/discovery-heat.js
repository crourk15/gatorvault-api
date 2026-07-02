/** Phase 4 — FutureCast heat mover discovery. */
const { intelFingerprint } = require('../commit-fingerprint');
const { SITE_URL } = require('./discovery-core');
function heatDiscoveryEnabled() { return process.env.X_AUTOPOST_HEAT_DISCOVERY !== 'false'; }
async function collectHeatMoverCandidates(opts) {
  opts = opts || {};
  if (!heatDiscoveryEnabled()) return [];
  const limit = opts.limit || parseInt(process.env.X_AUTOPOST_HEAT_MOVER_LIMIT || '5', 10);
  const out = [];
  try {
    const { buildHeatCheck } = require('../heat-check-store');
    const heat = await buildHeatCheck();
    for (const row of (heat && heat.rising || []).slice(0, limit)) {
      if (!row || !row.name) continue;
      const slug = row.slug || String(row.name).toLowerCase().replace(/\s+/g, '-');
      const fp = intelFingerprint(slug, 'heat_mover', new Date().toISOString().slice(0, 10));
      const classYear = row.classYear ? row.classYear + ' ' : '';
      const pos = row.pos ? ' ' + row.pos : '';
      const identity = (classYear + row.name + pos).trim();
      const text = [identity, 'GatorVault Heat Check — RPM momentum building on the Florida board.', 'Full prediction + visit intel ↓', SITE_URL + '/vault/futurecast/player/' + slug].join('\n');
      out.push({ text, category: 'news', topic: 'recruiting', urgencyLabel: 'analysis', sourceEventType: 'heat_mover', sources: [{ label: 'GatorVault Heat Check', url: SITE_URL }], source: 'auto:heat-mover', intelFingerprint: fp, playerName: row.name, playerSlug: slug, sourceEventCreatedAt: new Date().toISOString(), identityConfirmed: true, validationMeta: { eliteCompose: true, heatMover: true }, templateBlocks: { identity, context: 'GatorVault Heat Check — RPM momentum building on the Florida board.', insider: 'Full prediction + visit intel on FutureCast.' } });
    }
  } catch (err) { console.warn('[discovery-heat]', err.message); }
  return out;
}
module.exports = { heatDiscoveryEnabled, collectHeatMoverCandidates };
