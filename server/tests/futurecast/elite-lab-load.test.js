'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('FutureCast elite Lab load path', () => {
  it('batches recruiting lookups and single-flights allowlist board rows', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'allowlist-board.ts'),
      'utf8'
    );
    assert.match(src, /loadRecruitingPlayersBySlug/);
    assert.match(src, /getPlayersBySlugs/);
    assert.match(src, /allowlistedBoardPlayersInflight/);
    assert.match(src, /BOARD_PLAYERS_TTL_MS/);
    assert.doesNotMatch(src, /const recruiting = await loadRecruitingPlayer\(slug\)/);
  });

  it('exposes warmFuturecastLabCaches for master-board + trending', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /warmFuturecastLabCaches/);
    assert.match(src, /masterBoardCacheKey/);
    assert.match(src, /trendingBoardCacheKey/);
    assert.match(src, /buildMasterBoardPayload/);
  });

  it('keepalive priority-touches Lab critical path', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'render-keepalive-ping.js'),
      'utf8'
    );
    assert.match(src, /\/api\/futurecast\/master-board/);
    assert.match(src, /\/api\/futurecast\/trending/);
    assert.match(src, /\/api\/futurecast\/movement-intel\?year=2027/);
  });

  it('recruiting-store exports getPlayersBySlugs', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-store.js'),
      'utf8'
    );
    assert.match(src, /async function getPlayersBySlugs/);
    assert.match(src, /getPlayersBySlugs,/);
    assert.match(src, /\.in\('slug', chunk\)/);
  });

  it('Lab hook starts secondary in parallel with primary', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'client',
        'components',
        'futurecast',
        'lab',
        'useFutureCastLabData.ts'
      ),
      'utf8'
    );
    assert.match(src, /const primaryPromise = loadFutureCastLabPrimary\(\)/);
    assert.match(src, /const secondaryPromise = loadFutureCastLabSecondaryRaw\(\)/);
    assert.match(src, /await secondaryPromise/);
    assert.match(src, /hasUsableUfProbability/);
    assert.match(src, /keepHp/);
  });

  it('Lab high-priority fetch warm-polls for the commit-likelihood meter', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'client', 'lib', 'futurecast-lab-data.ts'),
      'utf8'
    );
    assert.match(src, /warmFetchHighPriority/);
    assert.match(src, /writeHighPriorityCache/);
  });

  it('warmFuturecastLabCaches starts high-priority early', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /const hpPromise = warmFuturecastHighPriorityCaches\(years\)/);
    assert.match(src, /Promise\.all/);
  });

  it('discovery hero meter does not fall back to Closing Class masterBoard', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'client',
        'components',
        'futurecast',
        'lab',
        'FutureCastHero.tsx'
      ),
      'utf8'
    );
    assert.match(src, /if \(discoveryFocus\)/);
    // Discovery branch must stay on highPriority — never Closing Class masterBoard.
    assert.match(src, /return \[\.\.\.highPriority\]/);
    // Accept ufProbability and legacy ufConfidence alias from seed/allowlist rows.
    assert.match(src, /ufProbability/);
    assert.match(src, /ufConfidence/);
  });
});
