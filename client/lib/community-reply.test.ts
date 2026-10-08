import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { communityReplyMention, withCommunityReplyMention } from './community-reply';

describe('community reply mention', () => {
  it('builds an @name prefix', () => {
    assert.equal(communityReplyMention('Billy Moody'), '@Billy Moody ');
    assert.equal(communityReplyMention('  '), '');
  });

  it('fills an empty composer', () => {
    assert.equal(withCommunityReplyMention('', 'Billy Moody'), '@Billy Moody ');
    assert.equal(withCommunityReplyMention('   ', 'Billy Moody'), '@Billy Moody ');
  });

  it('replaces a leading mention when you switch comments', () => {
    assert.equal(
      withCommunityReplyMention('@GatorVault Staff that ABC window', 'Billy Moody', 'GatorVault Staff'),
      '@Billy Moody that ABC window',
    );
  });

  it('prefixes typed copy so the name stays on the reply', () => {
    assert.equal(
      withCommunityReplyMention('that should have been a fumble', 'Billy Moody'),
      '@Billy Moody that should have been a fumble',
    );
  });
});
