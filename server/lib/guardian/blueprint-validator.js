/**
 * Guardian — validate index.html, CSS tokens, and JSON data against blueprints/*.json
 */
const fs = require('fs');
const path = require('path');
const loader = require('../self-runner/blueprint/blueprint-loader');
const schemaValidator = require('../self-runner/schema-validator');

const SERVER_ROOT = path.join(__dirname, '..', '..');

function readFileRel(rel) {
  const abs = path.join(SERVER_ROOT, rel);
  if (!fs.existsSync(abs)) return { ok: false, error: `missing file: ${rel}` };
  return { ok: true, content: fs.readFileSync(abs, 'utf8'), path: rel };
}

function extractRegion(html, regionId) {
  if (!regionId || !html.includes(`id="${regionId}"`)) return html;
  const start = html.indexOf(`id="${regionId}"`);
  const open = html.lastIndexOf('<', start);
  let depth = 0;
  let i = open;
  while (i < html.length) {
    if (html.slice(i, i + 2) === '< ') { i++; continue; }
    if (html.slice(i, i + 2) === '</') {
      depth--;
      if (depth === 0) return html.slice(open, i + html.slice(i).indexOf('>') + 1);
    } else if (html[i] === '<' && !html.slice(i, i + 4).startsWith('<!--')) {
      const tag = html.slice(i + 1).split(/[\s>]/)[0].replace('/', '');
      if (tag && !['br', 'img', 'input', 'meta', 'link', 'hr'].includes(tag.toLowerCase())) depth++;
    }
    i++;
  }
  return html;
}

function hookPresent(html, hookId, section) {
  const patterns = section?.acceptPatterns || section?.requiredHooks || [hookId];
  const regionId = section?.expectedLocation?.regionId;
  const scope = regionId ? extractRegion(html, regionId) : html;
  return patterns.some((p) => scope.includes(p) || html.includes(p));
}

function verifyHtmlBlueprint() {
  const errors = [];
  const warnings = [];
  const bp = loader.htmlBlueprint();
  const index = readFileRel('index.html');
  if (!index.ok) {
    errors.push(index.error);
    return { ok: false, errors, warnings, missing: bp.required || [] };
  }
  const html = index.content;
  const missing = [];
  for (const hookId of bp.required || []) {
    const section = bp.sections?.[hookId];
    if (!section) {
      warnings.push(`Blueprint section undefined for required hook: ${hookId}`);
      if (!html.includes(hookId)) missing.push(hookId);
      continue;
    }
    if (!hookPresent(html, hookId, section)) {
      missing.push(hookId);
      errors.push(
        `Missing HTML hook ${hookId} in index.html (expected ${section.expectedLocation?.description || 'see blueprints/html.json'})`
      );
    }
  }
  return { ok: errors.length === 0, errors, warnings, missing };
}

function verifyCssBlueprint() {
  const errors = [];
  const bp = loader.cssBlueprint();
  const tokens = loader.requiredCssTokens();
  for (const file of bp.files || ['css/gv-team.css']) {
    const cssFile = readFileRel(file);
    if (!cssFile.ok) {
      errors.push(cssFile.error);
      continue;
    }
    for (const [token, value] of Object.entries(tokens)) {
      if (!cssFile.content.includes(token)) {
        errors.push(`Missing CSS token ${token} in ${file} (expected value ${value})`);
      }
    }
  }
  return { ok: errors.length === 0, errors, missingTokens: errors.map((e) => e.match(/--[\w-]+/)?.[0]).filter(Boolean) };
}

function verifyJsonBlueprints({ criticalOnly = true } = {}) {
  const errors = [];
  const paths = loader.predeploySchemaPaths();
  const schemas = loader.jsonSchemas();

  for (const relPath of paths) {
    const schema = schemas[relPath];
    if (!schema) {
      errors.push(`No schema in blueprints/json-schemas.json for ${relPath}`);
      continue;
    }
    const result = schemaValidator.validateSchemaFile(relPath, schema);
    const critical = result.violations.filter((v) => v.severity === 'critical');
    const blocking = criticalOnly ? critical : result.violations;
    if (blocking.length) {
      errors.push(
        `${relPath}: ${blocking.length} schema violation(s) — ${blocking
          .slice(0, 3)
          .map((v) => v.issue || v.field || v.path)
          .join(', ')}`
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

function verifyBlueprints(options) {
  const html = verifyHtmlBlueprint();
  const css = verifyCssBlueprint();
  const json = verifyJsonBlueprints(options);
  const errors = [...html.errors, ...css.errors, ...json.errors];
  return {
    ok: errors.length === 0,
    errors,
    html,
    css,
    json,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  verifyBlueprints,
  verifyHtmlBlueprint,
  verifyCssBlueprint,
  verifyJsonBlueprints,
  hookPresent,
  SERVER_ROOT
};
