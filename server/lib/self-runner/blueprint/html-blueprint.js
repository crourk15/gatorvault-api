/**
 * Self-Runner 3.0 — HTML blueprint (RETIRED — React architecture uses react-vault-routes.json).
 */
const loader = require('./blueprint-loader');

function buildHooksMap() {
  const bp = loader.htmlBlueprint();
  if (bp.legacy || bp.architecture === 'react') return {};
  const hooks = {};
  Object.entries(bp.sections || {}).forEach(([key, section]) => {
    hooks[key] = {
      ...section,
      anchor: section.expectedLocation?.regionId
        ? `id="${section.expectedLocation.regionId}"`
        : section.expectedLocation?.before || section.expectedLocation?.inside,
      anchorType: section.expectedLocation?.before
        ? 'insert-before'
        : section.expectedLocation?.regionId
          ? 'inside-region'
          : 'after-opening-tag',
      regionId: section.expectedLocation?.regionId || null,
      file: section.expectedLocation?.file || 'index.html'
    };
  });
  return hooks;
}

const HTML_HOOKS = buildHooksMap();
const REQUIRED_HOOKS = loader.htmlBlueprint().legacy ? [] : loader.requiredHtmlHooks();
const AUTOPOSTER_INJECTION_ZONES = loader.htmlBlueprint().legacy ? [] : loader.htmlBlueprint().autoposterZones || [];
const PROTECTED_HOOKS = new Set(loader.htmlBlueprint().protected || []);

function hookByMarker(marker) {
  return (
    HTML_HOOKS[marker] ||
    Object.values(HTML_HOOKS).find((h) => h.id === marker || h.marker === marker) ||
    null
  );
}

function reloadFromDisk() {
  delete require.cache[require.resolve('./blueprint-loader')];
  const fresh = require('./blueprint-loader');
  const bp = fresh.htmlBlueprint();
  Object.keys(HTML_HOOKS).forEach((k) => delete HTML_HOOKS[k]);
  Object.assign(HTML_HOOKS, buildHooksMap());
  REQUIRED_HOOKS.length = 0;
  REQUIRED_HOOKS.push(...(bp.required || []));
  PROTECTED_HOOKS.clear();
  (bp.protected || bp.required || []).forEach((h) => PROTECTED_HOOKS.add(h));
}

module.exports = {
  HTML_HOOKS,
  REQUIRED_HOOKS,
  AUTOPOSTER_INJECTION_ZONES,
  PROTECTED_HOOKS,
  hookByMarker,
  reloadFromDisk
};
