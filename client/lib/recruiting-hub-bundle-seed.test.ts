import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaleAugust2027ClassLine,
  preferRecruitingHubBundle,
  recruitingHubBundleIsCurrent,
} from './recruiting-hub-bundle-seed.ts';
import type { RhHubBundle } from './recruiting-hub-elite-api.ts';
import { recruitingHubHeroBootScript } from './recruiting-hub-hero-boot.ts';

const august = {
  classRank: '#8',
  blueChip: '68%',
  commits: '26',
  avgRating: '89.9',
  trendRank: 'Stable',
  trendBlueChip: 'Rising',
  trendCommits: 'Rising',
  trendRating: 'Rising',
};
const live = {
  classRank: '#5',
  blueChip: '67%',
  commits: '27',
  avgRating: '90.1',
  trendRank: 'Stable',
  trendBlueChip: 'Rising',
  trendCommits: 'Rising',
  trendRating: 'Rising',
};

function bundle(overview: typeof live): RhHubBundle {
  return {
    year: 2027,
    classOverview: overview,
    commits: [{ id: 'easton-royal', name: 'Easton Royal' }],
  } as RhHubBundle;
}

test('leaving the hub does not paint the August class line back over the live one', () => {
  assert.equal(isStaleAugust2027ClassLine(2027, august), true);
  assert.equal(isStaleAugust2027ClassLine(2027, { ...august, commits: '27' }), true);
  assert.equal(isStaleAugust2027ClassLine(2027, live), false);
  assert.equal(isStaleAugust2027ClassLine(2028, august), false);
  const kept = preferRecruitingHubBundle(bundle(live), bundle(august), 2027);
  assert.equal(kept?.classOverview.classRank, '#5');
  assert.equal(kept?.classOverview.commits, '27');
  assert.equal(recruitingHubBundleIsCurrent(bundle(august), 2027), false);
  assert.equal(recruitingHubBundleIsCurrent(bundle(live), 2027), true);
});

test('hero boot remembers the live class line and refreshes when the page is shown again', () => {
  const src = recruitingHubHeroBootScript(2027);
  assert.match(src, /gv_hub_class_line_v1:2027/);
  assert.match(src, /augustClassLine/);
  assert.match(src, /pageshow/);
  assert.match(src, /if \(augustClassLine\(metrics\)\)/);
  assert.match(src, /data\.classOverview = null/);
  assert.equal(src.includes('\u0000'), false);
  new Function(src);
});
