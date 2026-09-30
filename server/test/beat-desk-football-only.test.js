/**
 * Beat Desk inbox is football only — hoops 5-star PG / PF stays off.
 * Run: node --test server/test/beat-desk-football-only.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isFootballDeskCopy } = require('../lib/post-studio-intel-inbox');

describe('Beat Desk football-only inbox', () => {
  it('drops basketball recruiting copy', () => {
    assert.equal(
      isFootballDeskCopy(
        'NEW: 5-star PG Cayden Daughtry broke down all four official visits with @JoeTipton — and he is down to Florida.'
      ),
      false
    );
    assert.equal(
      isFootballDeskCopy(
        '4-star PF Ian Condon commits to the Florida Gators UF has their first commitment in the class.'
      ),
      false
    );
  });

  it('keeps football beats', () => {
    assert.equal(
      isFootballDeskCopy(
        'Hudson West called Buster Faulkner a mastermind and a football guru after watching Florida.'
      ),
      true
    );
    assert.equal(
      isFootballDeskCopy(
        '4-star Samuel Bailey is a Gator. Now, the real work begins for Florida offensive line class.'
      ),
      true
    );
    assert.equal(
      isFootballDeskCopy(
        'Florida is headed to Missouri this weekend, and 4-star CB commit Raheem Floyd will be there.'
      ),
      true
    );
  });
});
