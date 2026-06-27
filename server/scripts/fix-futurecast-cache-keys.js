#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../lib/futurecast-cache-keys.js');
const content = [
  '/**',
  ' * Versioned FutureCast API cache keys — bump FUTURECAST_API_CACHE_VERSION when',
  ' * high-priority or master-board payload shape changes.',
  ' */',
  'const FUTURECAST_API_CACHE_VERSION = 3;',
  '',
  'function highPriorityCacheKey(classYear) {',
  '  return `futurecast:high-priority:v${FUTURECAST_API_CACHE_VERSION}:${classYear}`;',
  '}',
  '',
  'function masterBoardCacheKey() {',
  '  return `futurecast:master-board:v${FUTURECAST_API_CACHE_VERSION}`;',
  '}',
  '',
  'module.exports = {',
  '  FUTURECAST_API_CACHE_VERSION,',
  '  highPriorityCacheKey,',
  '  masterBoardCacheKey,',
  '};',
  '',
].join('\n');

fs.writeFileSync(target, content, 'utf8');
const mod = require(target);
console.log('[fix-futurecast-cache-keys] ok', mod.highPriorityCacheKey(2027));
