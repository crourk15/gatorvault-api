const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('readHubDiskSnapshot', () => {
  it('returns spread fields from snapshot json', () => {
    const cache = require('C:/Users/crour/OneDrive/Desktop/gatorvault/server/lib/recruiting-hub-cache.js');
    const tmp = path.join('C:/Users/crour/OneDrive/Desktop/gatorvault/server/hub-snapshot');
    if (!fs.existsSync(path.join(tmp, '2027', 'class-overview.json'))) {
      return;
    }
    const value = cache.readHubDiskSnapshot('class-overview', 2027);
    assert.ok(value);
    assert.ok('classRank' in value || 'commits' in value);
  });
});

describe('buildHubClassOverview source', () => {
  it('does not call movement-summary in builder source', () => {
    const src = fs.readFileSync('C:/Users/crour/OneDrive/Desktop/gatorvault/server/lib/recruiting-hub-elite.js', 'utf8');
    const fn = src.slice(src.indexOf('async function buildHubClassOverview'), src.indexOf('function movementLabel'));
    assert.doesNotMatch(fn, /buildMovementSummaryPayload/);
    assert.doesNotMatch(fn, /loadEnrichedBoard/);
    assert.match(fn, /getHubHsCommits/);
  });
});
