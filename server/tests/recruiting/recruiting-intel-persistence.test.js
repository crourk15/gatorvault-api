const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const persistence = require('../../lib/recruiting-intel-persistence');

test('persistence module exposes store info', () => {
  const info = persistence.getStoreInfo();
  assert.ok(info.mode === 'postgres' || info.mode === 'json');
});

test('migration file exists for recruiting_intel table', () => {
  const migration = path.join(__dirname, '../../migrations/019_create_recruiting_intel.sql');
  assert.ok(fs.existsSync(migration));
  const sql = fs.readFileSync(migration, 'utf8');
  assert.match(sql, /recruiting_intel/);
  assert.match(sql, /fingerprint TEXT PRIMARY KEY/);
});

test('intel store exports initIntelStore and getIntelStoreInfo', () => {
  const store = require('../../lib/recruiting-intel-store');
  assert.equal(typeof store.initIntelStore, 'function');
  assert.equal(typeof store.getIntelStoreInfo, 'function');
});
