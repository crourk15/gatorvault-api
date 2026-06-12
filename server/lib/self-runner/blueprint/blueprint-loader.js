/**
 * Self-Runner 3.0 — load canonical blueprints from server/blueprints/*.json
 */
const fs = require('fs');
const path = require('path');

const BLUEPRINT_DIR = path.join(__dirname, '..', '..', '..', 'blueprints');

function readBlueprint(name) {
  const filePath = path.join(BLUEPRINT_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blueprint missing: blueprints/${name}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

let _html = null;
let _css = null;
let _json = null;

function htmlBlueprint() {
  if (!_html) _html = readBlueprint('html.json');
  return _html;
}

function cssBlueprint() {
  if (!_css) _css = readBlueprint('css-tokens.json');
  return _css;
}

function jsonBlueprint() {
  if (!_json) _json = readBlueprint('json-schemas.json');
  return _json;
}

function hookSection(hookId) {
  const bp = htmlBlueprint();
  return bp.sections?.[hookId] || null;
}

function requiredHtmlHooks() {
  return htmlBlueprint().required || [];
}

function requiredCssTokens() {
  const bp = cssBlueprint();
  const tokens = bp.requiredTokens || {};
  return Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, v.value || v]));
}

function jsonSchemas() {
  return jsonBlueprint().schemas || {};
}

function predeploySchemaPaths() {
  const bp = jsonBlueprint();
  return bp.predeploySchemas || Object.keys(bp.schemas || {}).filter((p) => bp.schemas[p].predeploy);
}

module.exports = {
  BLUEPRINT_DIR,
  readBlueprint,
  htmlBlueprint,
  cssBlueprint,
  jsonBlueprint,
  hookSection,
  requiredHtmlHooks,
  requiredCssTokens,
  jsonSchemas,
  predeploySchemaPaths
};
