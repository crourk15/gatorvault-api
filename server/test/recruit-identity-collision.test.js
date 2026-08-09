'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  hasSlugNameFirstMismatch,
  explainSlugNameMismatch,
} = require('../lib/recruit-identity-collision');

describe('recruit identity collision guard', () => {
  it('flags jamarcus-johnson + Kamarion Johnson', () => {
    assert.equal(
      hasSlugNameFirstMismatch({ slug: 'jamarcus-johnson', name: 'Kamarion Johnson' }),
      true
    );
    const exp = explainSlugNameMismatch({ slug: 'jamarcus-johnson', name: 'Kamarion Johnson' });
    assert.equal(exp.slugFirst, 'jamarcus');
    assert.equal(exp.nameFirst, 'kamarion');
  });

  it('allows matching first names and initialed names', () => {
    assert.equal(
      hasSlugNameFirstMismatch({ slug: 'jamarcus-johnson', name: 'Jamarcus Johnson' }),
      false
    );
    assert.equal(
      hasSlugNameFirstMismatch({ slug: 'kamarion-johnson', name: 'Kamarion Johnson' }),
      false
    );
    assert.equal(
      hasSlugNameFirstMismatch({ slug: 'tj-shanahan', name: 'T.J. Shanahan' }),
      false
    );
    assert.equal(
      hasSlugNameFirstMismatch({ slug: 'kj-green', name: 'K.J. Green' }),
      false
    );
  });

  it('blocks desk feed soft-create on mismatch', async () => {
    const { feedDeskIntelToFutureCast } = require('../lib/desk-intel-futurecast-feed');
    const r = await feedDeskIntelToFutureCast({
      slug: 'jamarcus-johnson',
      player: {
        slug: 'jamarcus-johnson',
        name: 'Kamarion Johnson',
        classYear: 2027,
        pos: 'ATH',
      },
      dryRun: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'slug_name_identity_mismatch');
  });
});
