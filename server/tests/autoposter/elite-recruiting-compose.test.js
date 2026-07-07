const test = require('node:test');
const assert = require('node:assert/strict');

const elite = require('../../lib/autoposter/elite-recruiting-compose');

test('mergeBeatParts dedupes chunks', () => {
  const out = elite.mergeBeatParts(['Florida offer quote', 'florida offer quote', 'June visit to Gainesville']);
  assert.match(out, /June visit/);
  assert.equal(out.split('Florida offer quote').length - 1, 1);
});

test('isPr789OnlyRecruiting defaults on when elite mode on', () => {
  const prevElite = process.env.X_AUTOPOST_ELITE_MODE;
  const prevFlag = process.env.X_AUTOPOST_PR789_ONLY_RECRUITING;
  try {
    delete process.env.X_AUTOPOST_PR789_ONLY_RECRUITING;
    process.env.X_AUTOPOST_ELITE_MODE = 'true';
    assert.equal(elite.isPr789OnlyRecruiting(), true);
    process.env.X_AUTOPOST_PR789_ONLY_RECRUITING = 'false';
    assert.equal(elite.isPr789OnlyRecruiting(), false);
  } finally {
    process.env.X_AUTOPOST_ELITE_MODE = prevElite;
    if (prevFlag == null) delete process.env.X_AUTOPOST_PR789_ONLY_RECRUITING;
    else process.env.X_AUTOPOST_PR789_ONLY_RECRUITING = prevFlag;
  }
});

test('passesEliteRecruitingGate rejects thin fallback text', () => {
  const gate = elite.passesEliteRecruitingGate({
    ok: true,
    text: '2028 LB Test Player\nUF is positioned early in this cycle.\nfuturecast/player/test',
    playerName: 'Test Player',
    templateBlocks: {
      identity: '2028 LB Test Player',
      context: 'UF is positioned early in this cycle.',
      insider: 'Staff contact has picked up.'
    }
  }, 'test-player');
  assert.equal(gate.ok, false);
  assert.ok(gate.reason === 'thin_fallback' || gate.reason === 'pr6_fallback_blocked');
});
