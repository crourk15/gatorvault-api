/**
 * Self-Runner 3.0 — canonical platform blueprint (React vault + JSON + CSS).
 */
const html = require('./html-blueprint');
const css = require('./css-blueprint');
const json = require('./json-schemas');
const react = require('./react-blueprint');

const VERSION = react.REACT_ARCHITECTURE_VERSION;

function platformMap() {
  return {
    version: VERSION,
    architecture: 'react',
    react: {
      routes: react.VAULT_ROUTES,
      shell: react.SHELL_FILES,
      fixTypes: react.REACT_FIX_TYPES,
      forbiddenFiles: react.FORBIDDEN_PATCH_FILES,
      forbiddenEditTypes: react.FORBIDDEN_EDIT_TYPES
    },
    html: {
      legacy: true,
      note: 'Monolith HTML hooks retired — use react.routes',
      hooks: html.HTML_HOOKS,
      required: html.REQUIRED_HOOKS
    },
    json: {
      schemas: json.SCHEMAS,
      relationships: json.RELATIONSHIPS,
      paths: json.allSchemaPaths()
    },
    css: {
      primary: react.SHELL_FILES.css,
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
  json,
  react
};
