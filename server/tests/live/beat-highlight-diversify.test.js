const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickBeatHighlightPosts } = require('../../lib/beat-writer-filters');

describe('pickBeatHighlightPosts', () => {
  it('excludes brand Live and UF official, one card per writer', () => {
    const posts = [
      { handle: 'gatorvault', writerName: 'GatorVault', text: 'Brand post' },
      { handle: 'GatorsFB', writerName: 'Florida Gators Football', text: 'Official post' },
      { handle: 'Blake_Alderman', writerName: 'Blake Alderman', text: 'Alderman A' },
      { handle: 'Blake_Alderman', writerName: 'Blake Alderman', text: 'Alderman B' },
      { handle: 'Corey_Bender', writerName: 'Corey Bender', text: 'Bender A' },
      { handle: 'ZachAbolverdi', writerName: 'Zach Abolverdi', text: 'Zach A' },
    ];
    const out = pickBeatHighlightPosts(posts, 3);
    assert.equal(out.length, 3);
    const handles = out.map((p) => String(p.handle).toLowerCase());
    assert.deepEqual(handles, ['blake_alderman', 'corey_bender', 'zachabolverdi']);
  });

  it('does not invent GatorVault Live filler', () => {
    const out = pickBeatHighlightPosts(
      [{ handle: 'gatorvault', writerName: 'GatorVault Live', text: 'only brand' }],
      3
    );
    assert.equal(out.length, 0);
  });
});
