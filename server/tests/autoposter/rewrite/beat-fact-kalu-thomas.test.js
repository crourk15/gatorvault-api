/** Kalu / Thomas Jr — no generic board fallback or garbled quote embeds. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeGoldenFourFactPost } = require('../../../lib/player-intelligence/golden-four-compose');
const {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts,
  formatEliteQuoteEmbed
} = require('../../../lib/autoposter/rewrite/beat-fact-extractor');
const { validateBannedPhrases } = require('../../../lib/autoposter/rewrite/fact-gates');

const KALU_BEAT =
  'Florida didn\'t need an offer to get DL Isaac Kalubi Lukuni\'s attention..🧐 The Top-100 prospect explains why the SEC program had his attention long before his offer arrived 🐊 "I really like the Gators." DETAILS: https://t.co/SbDpjtYntF';

const THOMAS_BEAT =
  'Antonio Thomas Jr. has Florida firmly on his radar after his spring visit. He\'s telling me, "Man, you got to come down here." The Gators are in his top schools mix.';

test('Kalu beat selects quote/interest angle — not generic board fallback', () => {
  const facts = extractBeatFacts(KALU_BEAT, { player: { name: 'DK Kalu' } });
  assert.equal(facts.quote, 'I really like the Gators.');
  assert.equal(facts.boardSignal, false);
  const angle = selectAngleFromFacts(facts, KALU_BEAT);
  assert.notEqual(angle.angle, 'board');
  assert.equal(angle.angle, 'player_quote');
});

test('Kalu elite compose rejects Lukuni beat mis-tagged to Kalu', () => {
  const built = composeGoldenFourFactPost({
    slug: 'dk-kalu',
    intel: {
      playerName: 'DK Kalu',
      detail: KALU_BEAT,
      fingerprint: 'beat_offer_isaac-kalubi-lukunis_2026-07-01_corey_bender',
      classYear: 2026,
      pos: 'DL'
    },
    on3Sync: {
      rankingTokens: { on3Stars: 3, on3NationalRank: 684, on3PositionRank: 73, on3StateRank: 108 },
      stars: 3,
      natlRank: 684,
      posRank: 73,
      stateRank: 108
    },
    playerRow: { name: 'DK Kalu', classYear: 2026, pos: 'DL', hometownState: 'TX', state: 'TX' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'beat_identity_mismatch');
});

test('Valid Kalu beat composes interest + clean quote', () => {
  const beat =
    'Florida had DK Kalu\'s attention before the offer landed, and the Gators remain in his mix early — "I really like the Gators."';
  const built = composeGoldenFourFactPost({
    slug: 'dk-kalu',
    intel: { playerName: 'DK Kalu', detail: beat, classYear: 2026, pos: 'DL' },
    on3Sync: {
      rankingTokens: { on3Stars: 3, on3NationalRank: 684, on3PositionRank: 73, on3StateRank: 108 },
      stars: 3,
      natlRank: 684,
      posRank: 73,
      stateRank: 108
    },
    playerRow: { name: 'DK Kalu', classYear: 2026, pos: 'DL', hometownState: 'TX', state: 'TX' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.doesNotMatch(built.text, /top-school mix on his board early/i);
  assert.match(built.text, /really likes the Gators/i);
});

test('Thomas beat rejects reporter-voice pseudo-quotes', () => {
  const facts = extractBeatFacts(THOMAS_BEAT, { player: { name: 'Antonio Thomas Jr.' } });
  assert.equal(facts.quote, null);
  const angle = selectAngleFromFacts(facts, THOMAS_BEAT);
  assert.notEqual(angle.angle, 'board');
});

test('Thomas elite compose avoids garbled reporter quote embed', () => {
  const built = composeGoldenFourFactPost({
    slug: 'antonio-thomas-jr',
    intel: { playerName: 'Antonio Thomas Jr.', detail: THOMAS_BEAT, classYear: 2028, pos: 'EDGE' },
    on3Sync: {
      rankingTokens: { on3Stars: 4, on3NationalRank: 17, on3PositionRank: 4, on3StateRank: 5 },
      stars: 4,
      natlRank: 17,
      posRank: 4,
      stateRank: 5
    },
    playerRow: { name: 'Antonio Thomas Jr.', classYear: 2028, pos: 'EDGE', state: 'FL' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.doesNotMatch(built.text, /top-school mix on his board early/i);
  assert.doesNotMatch(built.text, /He's telling me/i);
  assert.doesNotMatch(built.text, /\.'\./);
});

test('formatEliteQuoteEmbed third-person grammar for I-like quotes', () => {
  const embed = formatEliteQuoteEmbed('I really like the Gators.');
  assert.match(embed, /really likes the Gators/i);
  assert.doesNotMatch(embed, /he said he "really like/i);
});
