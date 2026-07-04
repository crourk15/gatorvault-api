const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const platform = require('C:/Users/crour/OneDrive/Desktop/gatorvault/server/lib/autoposter/detectives-platform.js');
const detectives = require('C:/Users/crour/OneDrive/Desktop/gatorvault/server/lib/autoposter/detectives.js');

describe('detectives-platform', () => {
  it('detects FutureCast context from board fields', () => {
    assert.equal(platform.playerHasFutureCastContext({ slug: 'x', on3Id: '1', stars: 4 }), true);
    assert.equal(platform.playerHasFutureCastContext({ slug: 'x', name: 'Stub' }), false);
  });
  it('routes stub players to Recruiting Hub URL', () => {
    const url = platform.resolvePlayerPlatformUrl('tory-clark', false);
    assert.match(url, /\/vault\/recruiting\/player\/tory-clark$/);
  });
  it('routes board-ready players to FutureCast URL', () => {
    const url = platform.resolvePlayerPlatformUrl('tory-clark', true);
    assert.match(url, /\/vault\/futurecast\/player\/tory-clark$/);
  });
  it('infers unofficial visit from swamp language', () => {
    assert.equal(
      platform.inferBeatEventType('2028 DL Tory Clark was in the Swamp for Friday Night Lights'),
      'unofficial_visit'
    );
  });
});

describe('detectives beat-driven compose', () => {
  it('buildBeatDrivenCandidate avoids FutureCast insider copy', () => {
    const caseItem = { id: 'case-1', skipReason: 'no_recruiting_signal' };
    const hints = {
      beatText: '2028 DL Tory Clark was in the Swamp for Friday Night Lights on June 19.',
      writerName: 'Tyler Harden'
    };
    const identity = { playerName: 'Tory Clark', playerSlug: 'tory-clark', classYear: 2028, pos: 'DL' };
    const platformContext = {
      hasFutureCastContext: false,
      url: 'https://gatorvaultinsider.com/vault/recruiting/player/tory-clark'
    };
    const cand = detectives.buildBeatDrivenCandidate(caseItem, hints, identity, platformContext);
    assert.match(cand.text, /Tory|Gainesville|FNL|Swamp/i);
    assert.doesNotMatch(cand.text, /FutureCast|RPM percentages|the prospect/i);
    assert.match(cand.text, /\/player\/tory-clark/);
    assert.equal(cand.validationMeta.beatDrivenOnly, true);
    assert.equal(cand.validationMeta.platformPlayerReady, false);
  });
});
