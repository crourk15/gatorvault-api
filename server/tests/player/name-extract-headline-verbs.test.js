'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractPlayerFromText } = require('../../lib/x-autoposter-copy');
const { isValidPlayerName } = require('../../lib/x-autoposter-player-context');

describe('headline verb player-name extract', () => {
  it('strips Continues/Remains/Opens from Isaiah Reeves headlines', () => {
    assert.equal(
      extractPlayerFromText('Isaiah Reeves continues rising on Florida board'),
      'Isaiah Reeves'
    );
    assert.equal(
      extractPlayerFromText('Isaiah Reeves Continues To Impress Florida Staff'),
      'Isaiah Reeves'
    );
    assert.equal(
      extractPlayerFromText('BREAKING: Isaiah Reeves remains a Florida priority'),
      'Isaiah Reeves'
    );
    assert.equal(isValidPlayerName('Isaiah Reeves Continues'), false);
  });

  it('does not treat Safety as a first name', () => {
    assert.equal(
      extractPlayerFromText('Safety Isaiah Reeves opens up on Florida offer'),
      'Isaiah Reeves'
    );
  });
});
