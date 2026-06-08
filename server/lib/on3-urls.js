const { slugify } = require('./slug');

const SITE_BASE = process.env.ON3_SITE_BASE || 'https://www.on3.com';

/**
 * Canonical On3 player profile URL (Rivals DB path).
 * On3 player.slug is typically "{name-slug}-{on3Id}" e.g. eric-singleton-jr-155719
 */
function buildOn3ProfileUrl(player) {
  if (!player) return `${SITE_BASE}/college/florida-gators/football/2026/commits/`;

  const direct = player.on3ProfileUrl || player.on3_profile_url;
  if (direct && String(direct).startsWith('http')) return direct;

  const on3Slug = player.on3Slug || player.on3_slug;
  if (on3Slug) {
    const slug = String(on3Slug).replace(/^\//, '').replace(/\/$/, '');
    return `${SITE_BASE}/rivals/${slug}/`;
  }

  const on3Id = player.on3Id || player.on3_id;
  if (on3Id) {
    const id = String(on3Id);
    let base = player.slug || slugify(player.name || '');
    if (base.endsWith(`-${id}`)) {
      return `${SITE_BASE}/rivals/${base}/`;
    }
    base = base.replace(/-\d+$/, '');
    return `${SITE_BASE}/rivals/${base}-${id}/`;
  }

  return `${SITE_BASE}/college/florida-gators/football/2026/commits/`;
}

module.exports = {
  SITE_BASE,
  buildOn3ProfileUrl
};
