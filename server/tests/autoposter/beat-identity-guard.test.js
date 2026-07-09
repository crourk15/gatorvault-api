const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectBeatIdentityMismatch,
  filterBeatIntelRows,
  pickBeatIntelRow
} = require('../../lib/autoposter/beat-identity-guard');

test('detectBeatIdentityMismatch flags Lukuni beat tagged to DK Kalu', () => {
  const beat =
    'Florida didn\'t need an offer to get DL Isaac Kalubi Lukuni\'s attention.. "I really like the Gators."';
  const out = detectBeatIdentityMismatch('dk-kalu', 'DK Kalu', beat, {
    fingerprint: 'beat_offer_isaac-kalubi-lukunis_2026-07-01_corey_bender'
  });
  assert.equal(out.mismatch, true);
  assert.equal(out.reason, 'fingerprint_names_other_player');
});

test('pickBeatIntelRow skips mismatched rows', () => {
  const rows = [
    {
      playerSlug: 'dk-kalu',
      playerName: 'DK Kalu',
      fingerprint: 'beat_offer_isaac-kalubi-lukunis_2026-07-01_corey_bender',
      detail: 'Florida didn\'t need an offer to get DL Isaac Kalubi Lukuni\'s attention..'
    }
  ];
  assert.equal(pickBeatIntelRow('dk-kalu', rows), null);
});

test('detectBeatIdentityMismatch flags coach news mislinked to recruit slug', () => {
  const beat =
    'Former Florida #Gators coach Billy Donovan will become the lead assistant coach for the San Antonio #Spurs under Mitch Johnson, per reports.';
  const out = detectBeatIdentityMismatch('billy-donovan', 'Billy Donovan', beat, {
    fingerprint: 'beat_target_update_billy-donovan_2026-07-02_onlygators'
  });
  assert.equal(out.mismatch, true);
  assert.equal(out.reason, 'coach_news_mislink');
});
