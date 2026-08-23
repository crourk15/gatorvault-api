'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('chase-why-store seed ∪ durable merge', () => {
  let tmp;
  let prev;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chase-why-'));
    prev = process.env.CHASE_WHY_DURABLE_DIR;
    process.env.CHASE_WHY_DURABLE_DIR = tmp;
    // Force fresh require after env set
    delete require.cache[require.resolve('../lib/chase-why-store')];
  });

  after(() => {
    if (prev === undefined) delete process.env.CHASE_WHY_DURABLE_DIR;
    else process.env.CHASE_WHY_DURABLE_DIR = prev;
    delete require.cache[require.resolve('../lib/chase-why-store')];
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (_) {}
  });

  it('empty durable still serves seed handwrites (Vickers)', () => {
    fs.writeFileSync(
      path.join(tmp, 'chase-why-overrides.json'),
      JSON.stringify({ version: 1, updatedAt: null, bySlug: {} }) + '\n',
      'utf8'
    );
    delete require.cache[require.resolve('../lib/chase-why-store')];
    const store = require('../lib/chase-why-store');
    const text = store.getOverride('izayah-vickers');
    assert.ok(text, 'expected seed override');
    assert.match(text, /Quiet CB|already leads on On3/i);
    assert.doesNotMatch(text, /Florida already owns this CB/i);
    const doc = store.loadDoc();
    assert.ok(Object.keys(doc.bySlug).length >= 50, 'seed board should load');
  });

  it('durable slug wins over seed', () => {
    fs.writeFileSync(
      path.join(tmp, 'chase-why-overrides.json'),
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        bySlug: {
          'izayah-vickers': { text: 'Durable override for Vickers only.', updatedBy: 'test' },
        },
      }) + '\n',
      'utf8'
    );
    delete require.cache[require.resolve('../lib/chase-why-store')];
    const store = require('../lib/chase-why-store');
    assert.equal(store.getOverride('izayah-vickers'), 'Durable override for Vickers only.');
    assert.match(store.getOverride('brysen-wright') || '', /WR|Wright|Miami/i);
  });
});
