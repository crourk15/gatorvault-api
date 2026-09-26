import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldSkipSwrCache } from './stale-while-revalidate';

describe('shouldSkipSwrCache', () => {
  it('skips the hub ticker so an items-only cache cannot hide nowWeek', () => {
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/ticker?year=2027'), true);
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/ticker'), true);
  });

  it('skips hub bundle and commits so a last-good Armani-only plate cannot hide Cyion', () => {
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/bundle?year=2028'), true);
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/commits?year=2028'), true);
  });

  it('still caches other hub reads', () => {
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/footprint?year=2027'), false);
  });
});
