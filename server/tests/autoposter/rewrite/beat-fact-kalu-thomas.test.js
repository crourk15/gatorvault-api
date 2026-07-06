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
  'Florida is making 2028 4-star EDGE Antonio Thomas Jr. a priority early on, and the interest is certainly mutual. Not to mention, he\'s teammates with a current Florida commit. "He\'s telling me, \'Man, you got to come down here.\'"';

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
  assert.equal(facts.offerInterest, true);
  const angle = selectAngleFromFacts(facts, THOMAS_BEAT);
  assert.equal(angle.angle, 'player_quote');
});

test('Thomas beat resolves UF commit teammate when school is known', () => {
  const facts = extractBeatFacts(THOMAS_BEAT, {
    slug: 'antonio-thomas-jr',
    player: { name: 'Antonio Thomas Jr.', classYear: 2028 },
    playerRow: { school: 'Carrollwood Day (Tampa, FL)', classYear: 2028 }
  });
  assert.equal(facts.ufCommitTeammate?.slug, 'devoun-kendrick');
  assert.equal(facts.ufCommitTeammate?.name, "De'Voun Kendrick");
});

test('Thomas elite compose names Kendrick when roster resolves teammate', () => {
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
    playerRow: {
      name: 'Antonio Thomas Jr.',
      classYear: 2028,
      pos: 'EDGE',
      state: 'FL',
      school: 'Carrollwood Day (Tampa, FL)'
    },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.match(built.text, /UF commit De'Voun Kendrick already in his circle/i);
  assert.doesNotMatch(built.text, /Gators commit already in his circle/i);
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
  assert.match(built.text, /making Thomas a priority early/i);
  assert.match(built.text, /mutual interest is real/i);
  assert.doesNotMatch(built.text, /top-school mix on his board early/i);
  assert.doesNotMatch(built.text, /He's telling me/i);
  assert.doesNotMatch(built.text, /\.'\./);
  assert.doesNotMatch(built.text, /already in his circle/i);
});

test('formatEliteQuoteEmbed third-person grammar for I-like quotes', () => {
  const embed = formatEliteQuoteEmbed('I really like the Gators.');
  assert.match(embed, /really likes the Gators/i);
  assert.doesNotMatch(embed, /he said he "really like/i);
});
