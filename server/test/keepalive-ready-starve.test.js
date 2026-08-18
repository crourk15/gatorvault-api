'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('keepalive / HP heal must not starve /ready', () => {
  it('render keepalive is ping-only (FULL_TOUCH off)', () => {
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', 'render.yaml'), 'utf8');
    const keepalive = yaml.slice(yaml.indexOf('gatorvault-api-keepalive'));
    const nextService = keepalive.search(/\n  - type:/);
    const block = nextService > 0 ? keepalive.slice(0, nextService) : keepalive;
    assert.match(block, /KEEPALIVE_FULL_TOUCH[\s\S]*value: "false"/);
    assert.doesNotMatch(block, /KEEPALIVE_FULL_TOUCH[\s\S]*value: "true"/);
  });

  it('HP sanitize does not schedule players.json heal warm', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api/futurecast/response-cache.ts'),
      'utf8'
    );
    const sanitizeStart = src.indexOf('export function sanitizeHighPriorityStarsPayload');
    assert.ok(sanitizeStart > 0, 'expected sanitizeHighPriorityStarsPayload');
    const sanitizeEnd = src.indexOf('\nexport function', sanitizeStart + 10);
    const sanitize = src.slice(sanitizeStart, sanitizeEnd > 0 ? sanitizeEnd : undefined);
    assert.doesNotMatch(sanitize, /scheduleHealPlayersWarm\s*\(/);
  });

  it('heal warm is deferred + heavy-gated (not request microtask)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'api/futurecast/response-cache.ts'),
      'utf8'
    );
    assert.match(src, /runHeavyJob\('hp-heal-players-warm'/);
    assert.match(src, /HP_HEAL_WARM_DEFER_MS/);
    assert.match(src, /never schedule ~9MB players\.json warm from the request path/);
    assert.match(src, /lookupHealBoardTruth[\s\S]*return healTruthBySlug\.get/);
  });

  it('boot schedules HP heal warm after priority-lite (not on GET)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib/recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /ensureHealPlayersWarm/);
    assert.match(src, /HP_HEAL_WARM_BOOT_DELAY_MS/);
  });
});
