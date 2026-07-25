const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('tsx/cjs');

const { getUfCommitSlugSet } = require('../../lib/recruiting-uf-commit-slugs');
const { isUfCommitRow } = require('../../api/futurecast/eligibility.ts');
const { getAllowlistSet } = require('../../lib/recruiting-target-allowlist');

describe('FutureCast Top Targets excludes UF commits', () => {
  it('getUfCommitSlugSet includes Armani Strong for 2028', async () => {
    const slugs = await getUfCommitSlugSet(2028);
    assert.ok(slugs.has('armani-strong'), 'Armani Strong must be treated as a 2028 UF commit');
  });

  it('isUfCommitRow recognizes Florida HS commits', () => {
    assert.equal(
      isUfCommitRow({
        lifecycle: 'HS',
        committed_to: 'Florida',
        uf_status: null,
      }),
      true
    );
    assert.equal(
      isUfCommitRow({
        lifecycle: 'HS',
        committed_to: null,
        uf_status: 'TARGET',
      }),
      false
    );
  });

  it('Armani Strong is not an active 2028 allowlist target', () => {
    assert.equal(getAllowlistSet(2028).has('armani-strong'), false);
  });

  it('FutureCast players seed marks Armani Strong committed to Florida', () => {
    const playersPath = path.join(__dirname, '..', '..', 'data', 'players.json');
    const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    const row = players.find((p) => String(p.slug || '').toLowerCase() === 'armani-strong');
    assert.ok(row, 'armani-strong row exists in FutureCast players seed');
    assert.match(String(row.committed_to || ''), /florida/i);
  });

  it('watchlist API filters recruiting-store commits before card render', () => {
    const watchlistPath = path.join(__dirname, '..', '..', 'api', 'uf-fit', 'watchlist.ts');
    const src = fs.readFileSync(watchlistPath, 'utf8');
    assert.match(src, /getUfCommitSlugSet/);
    assert.match(src, /isUfCommitRow/);
  });
});
