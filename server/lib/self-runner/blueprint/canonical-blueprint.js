/**
 * Self-Runner 2.0 — canonical platform blueprint (HTML + JSON + CSS).
 */
const html = require('./html-blueprint');
const css = require('./css-blueprint');
const json = require('./json-schemas');

const VERSION = '2.0.0';

function platformMap() {
  return {
    version: VERSION,
    html: {
      hooks: html.HTML_HOOKS,
      required: html.REQUIRED_HOOKS,
      autoposterZones: html.AUTOPOSTER_INJECTION_ZONES,
      protected: [...html.PROTECTED_HOOKS]
    },
    json: {
      schemas: json.SCHEMAS,
      relationships: json.RELATIONSHIPS,
      paths: json.allSchemaPaths()
    },
    css: {
      tokens: css.REQUIRED_TOKENS,
      eraGradients: css.ERA_GRADIENT_CLASSES,
      files: css.THEME_FILES
    }
  };
}

module.exports = {
  VERSION,
  platformMap,
  html,
  css,
  json
};
