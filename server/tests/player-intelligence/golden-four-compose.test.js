/** Golden-four fact compose — elite PR-789 only, no PR-6 fallback. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeGoldenFourFactPost, PR6_FALLBACK_RE } = require('../../lib/player-intelligence/golden-four-compose');
const { GOLDEN_BEATS } = require('../autoposter/fixtures/golden-beats');
const { getTweetCharLimit } = require('../../lib/autoposter/tweet-char-limit');

const WILLINGHAM_BEAT = GOLDEN_BEATS.find((b) => b.id === 'willingham');

test('composeGoldenFourFactPost — Willingham elite board arc with On3 ranks', () => {
  const out = composeGoldenFourFactPost({
    slug: 'bryce-willingham',
    intel: {
      playerName: 'Bryce Willingham',
      detail: WILLINGHAM_BEAT.beatText,
      source: 'Beat writer'
    },
    on3Sync: {
      ok: true,
      rankingValid: true,
      stars: 4,
      natlRank: 304,
      posRank: 31,
      stateRank: 40,
      rankingTokens: {
        on3Stars: 4,
        on3NationalRank: 304,
        on3PositionRank: 31,
        on3StateRank: 40
      }
    },
    playerRow: {
      name: 'Bryce Willingham',
      pos: 'CB',
      classYear: 2028,
      hometownState: 'GA',
      competitors: [
        { school: 'Georgia', pct: 28 },
        { school: 'Florida', pct: 22 }
      ]
    }
  });

  assert.equal(out.ok, true, out.reason || JSON.stringify(out));
  assert.ok(out.text.length <= getTweetCharLimit(), `too long: ${out.text.length}`);
  assert.match(out.text, /2028 CB Bryce Willingham/i);
  assert.match(out.text, /4★|4-star/i);
  assert.match(out.text, /304|No\. 304/i);
  assert.match(out.text, /spring practice/i);
  assert.match(out.text, /Definitely one of my top schools/i);
  assert.doesNotMatch(out.text, PR6_FALLBACK_RE);
  assert.doesNotMatch(out.text, /put UF on his board early/i);
  assert.equal(out.validationMeta?.goldenFourFactCompose, true);
  assert.equal(out.validationMeta?.publishTier, 'pr789_angle');
});

test('composeGoldenFourFactPost — blocks PR-6 template phrasing', () => {
  const pr6Text =
    '2028 CB Test Player · 4★\nFlorida gave Test Player a foothold and put UF on his board early.\ngatorvaultinsider.com/vault/futurecast/player/test';
  assert.match(pr6Text, PR6_FALLBACK_RE);
});

test('composeGoldenFourFactPost — fails closed without beat text', () => {
  const out = composeGoldenFourFactPost({ slug: 'bryce-willingham', intel: {} });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'missing_beat_text');
});
