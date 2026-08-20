'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Render /ready crash-loop guards (Aug 18 exit 143 + 5s health)', () => {
  it('hub-warm cron is 2028-only spaced and does not force-restart', () => {
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', 'render.yaml'), 'utf8');
    const start = yaml.indexOf('gatorvault-api-hub-warm');
    assert.ok(start > 0, 'expected hub-warm cron');
    const nextService = yaml.slice(start).search(/\n  - type:/);
    const block = nextService > 0 ? yaml.slice(start, start + nextService) : yaml.slice(start);
    assert.match(block, /mode=spaced&years=2028/);
    assert.doesNotMatch(block, /years=2027,2028/);
    assert.doesNotMatch(block, /force=1/);
    // Staggered off :00/:30 so it does not stack with recruiting-light / ingest.
    assert.match(block, /schedule:\s*"12,42 \* \* \* \*"/);
  });

  it('recruiting-ingest is staggered off recruiting-light :00', () => {
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', 'render.yaml'), 'utf8');
    const start = yaml.indexOf('gatorvault-api-recruiting-ingest');
    assert.ok(start > 0);
    const nextService = yaml.slice(start).search(/\n  - type:/);
    const block = nextService > 0 ? yaml.slice(start, start + nextService) : yaml.slice(start);
    assert.match(block, /schedule:\s*"15 \*\/2 \* \* \*"/);
  });

  it('spaced fork skips when parent RSS is high', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib/recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /HUB_SPACED_FORK_PARENT_RSS_MB/);
    assert.match(src, /spaced-fork-/);
  });

  it('Admin Hub probe does not instant-red on Failed to fetch', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js/admin-hub-core.js'), 'utf8');
    assert.match(src, /probe_timeout/);
    assert.match(src, /AbortController/);
    // Network blips must use wake grace — not hardDown regex.
    const escalateStart = src.indexOf('function escalateApiDown');
    assert.ok(escalateStart > 0);
    const escalate = src.slice(escalateStart, escalateStart + 1200);
    assert.doesNotMatch(escalate, /Failed to fetch\|NetworkError\|Load failed/);
    assert.match(escalate, /status === 502 \|\| status === 504/);
  });

  it('spaced warm-memory does not force by default', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib/recruiting-hub-routes.js'),
      'utf8'
    );
    const start = src.indexOf("mode === 'spaced'");
    assert.ok(start > 0);
    const slice = src.slice(start, start + 2200);
    assert.match(slice, /forceSpaced/);
    assert.doesNotMatch(slice, /force:\s*true/);
    assert.match(slice, /req\.query\.force/);
  });

  it('spaced fork workers are serialized and capped ≤1024 by default', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib/recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /spacedEliteWorkerChain/);
    assert.match(src, /killSpacedEliteChild/);
    assert.match(src, /HUB_SPACED_WORKER_MAX_OLD_SPACE_MB \|\| '1024'/);
    assert.doesNotMatch(src, /HUB_SPACED_WORKER_MAX_OLD_SPACE_MB \|\| '1536'/);
  });

  it('render.yaml worker heap is 1024', () => {
    const yaml = fs.readFileSync(path.join(__dirname, '..', '..', 'render.yaml'), 'utf8');
    assert.match(
      yaml,
      /HUB_SPACED_WORKER_MAX_OLD_SPACE_MB[\s\S]*?value:\s*"1024"/
    );
  });

  it('warm job batch yields for health probes between keys', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib/recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /yieldForHealthProbe/);
    assert.match(src, /HUB_WARM_YIELD_MS/);
  });
});
