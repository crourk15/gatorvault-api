import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldSkipSwrCache } from './stale-while-revalidate';

describe('shouldSkipSwrCache', () => {
  it('skips the hub ticker so an items-only cache cannot hide nowWeek', () => {
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/ticker?year=2027'), true);
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/ticker'), true);
  });

  it('still caches other hub reads', () => {
    assert.equal(shouldSkipSwrCache('/api/recruiting/hub/bundle?year=2027'), false);
  });
});
