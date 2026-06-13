/**
 * Section-level QA — delegates to React-native crawler integrity checks.
 */
const integrity = require('../crawler/checks/integrity');
const { SITE_SECTIONS, LOCAL_ASSETS } = require('./qa-coverage-map');
const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..', '..');

function readLocal(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

module.exports = {
  ...integrity,
  readLocal,
  SITE_SECTIONS,
  LOCAL_ASSETS
};
