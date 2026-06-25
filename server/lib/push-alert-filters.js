/**
 * Push alert recipient filters — server-side prefs enforcement.
 */

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function subscriberMatchesPayload(sub, payload) {
  const watchlist = sub?.prefs?.followPlayers;
  if (!Array.isArray(watchlist) || watchlist.length === 0) return true;

  const slug = normalizeToken(payload?.playerSlug);
  const name = String(payload?.playerName || "").trim().toLowerCase();

  return watchlist.some((entry) => {
    const raw = String(entry || "").trim();
    if (!raw) return false;
    const token = normalizeToken(raw);
    const lower = raw.toLowerCase();
    if (slug && token && (slug === token || slug.includes(token) || token.includes(slug))) {
      return true;
    }
    if (name && (name === lower || name.includes(lower) || lower.includes(name))) {
      return true;
    }
    return false;
  });
}

module.exports = { subscriberMatchesPayload, normalizeToken };