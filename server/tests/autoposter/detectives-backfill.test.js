/** Detectives backfill — rebuild pile from beat prefilter skips */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GENERIC_BEAT =
  'Intel on the way — Florida hosting a top 2028 WR visitor this weekend per campus sources.';

function withDetectivesDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-det-backfill-'));
  process.env.X_AUTOPOST_DETECTIVES_DATA_DIR = dir;
  delete require.cache[require.resolve('../../lib/autoposter/detectives-store')];
  delete require.cache[require.resolve('../../lib/autoposter/detectives-backfill')];
  delete require.cache[require.resolve('../../lib/autoposter/detectives')];
  delete require.cache[require.resolve('../../lib/beat-intel-prefilter')];
  try {
    return fn(require('../../lib/autoposter/detectives-backfill'));
  } finally {
    delete process.env.X_AUTOPOST_DETECTIVES_DATA_DIR;
    delete require.cache[require.resolve('../../lib/autoposter/detectives-store')];
    delete require.cache[require.resolve('../../lib/autoposter/detectives-backfill')];
    delete require.cache[require.resolve('../../lib/autoposter/detectives')];
    delete require.cache[require.resolve('../../lib/beat-intel-prefilter')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('backfillFromPosts creates cases for handoff-eligible prefilter skips', async () => {
  await withDetectivesDir(async (backfill) => {
    const prefilter = require('../../lib/beat-intel-prefilter');
    const originalGuard = prefilter.guardBeatPost;
    prefilter.guardBeatPost = async (post) => ({
      eligible: false,
      skip: {
        nonPlayerIntel: {
          reason: 'generic_phrase',
          category: 'non_player_intel',
          triggerPhrase: post?.text || '',
        },
      },
      text: post?.text || '',
    });

    try {
      const posts = [
        {
          text: GENERIC_BEAT,
          handle: '@Corey_Bender',
          writerName: 'Corey Bender',
          url: 'https://x.com/corey_bender/status/backfill-test',
          publishedAt: new Date().toISOString(),
        },
      ];

      const stats = await backfill.backfillFromPosts(posts);
      assert.equal(stats.ok, true);
      assert.equal(stats.scanned, 1);
      assert.ok(stats.handoffs >= 1);
      assert.ok(stats.created + stats.refreshed + stats.failedFinal >= 1);
    } finally {
      prefilter.guardBeatPost = originalGuard;
    }
  });
});

test('pileNeedsBackfill is true on empty store', () => {
  withDetectivesDir((backfill) => {
    assert.equal(backfill.pileNeedsBackfill(), true);
  });
});
