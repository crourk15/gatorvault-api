/**
 * Self-Runner — React-native failure explanations (no monolith hook language).
 */
const fs = require('fs');
const path = require('path');
const reactBp = require('../blueprint/react-blueprint');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'self-runner-config.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function template(key, vars) {
  const cfg = loadConfig();
  let text = cfg.explainerTemplates?.[key] || key;
  Object.entries(vars || {}).forEach(([k, v]) => {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  });
  return text;
}

function explain(checkId, issue) {
  const id = String(checkId || issue?.checkId || '');
  const route = reactBp.routeForCheck(id);
  const meta = reactBp.componentForRoute(route);

  if (/react-exports|react-markers|missing-content/.test(id)) {
    return template('missing-component', { component: meta.component, route });
  }
  if (/404|route|crawler:404/.test(id)) {
    return template('broken-route', { route: issue?.details?.[0]?.file || route });
  }
  if (/slug|player-profile/.test(id)) {
    return template('invalid-slug', {});
  }
  if (/hydration|ssg/.test(id)) {
    return template('hydration-mismatch', { route });
  }
  if (/scroll-containers|overflow/.test(id)) {
    return template('missing-scroll', {});
  }
  if (/mobile-safari|safe-area/.test(id)) {
    return template('missing-safe-area', {});
  }
  if (/modal-zindex|panel-clipping|layering/.test(id)) {
    return template('modal-layering', {});
  }
  if (/feed-dedup|autoposter/.test(id)) {
    return 'Repair data/live/feed-items.json — VaultLiveFeedPage displays via /api/live/dashboard';
  }
  if (/film-source|film-room/.test(id)) {
    return `Fix Film Room source URLs in data/film-room-knowledge — ${meta.component}`;
  }
  if (/retired-monolith|team-hooks|film-room-hooks|vpane/.test(id)) {
    return 'Retired monolith check — use React pages:react-* and integrity:react-* checks instead';
  }

  return reactBp.reactExplanation(id, issue);
}

module.exports = { explain, template, loadConfig };
