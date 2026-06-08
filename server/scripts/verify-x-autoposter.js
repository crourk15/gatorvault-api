#!/usr/bin/env node
/**
 * Verify X OAuth 1.0a credentials for @gatorvault AutoPoster.
 * Usage:
 *   node scripts/verify-x-autoposter.js           # verify only
 *   node scripts/verify-x-autoposter.js --post "Test tweet — delete me"
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const autoposter = require('../lib/x-autoposter');

async function main() {
  const args = process.argv.slice(2);
  const postIdx = args.indexOf('--post');
  const postText = postIdx >= 0 ? args[postIdx + 1] : null;

  console.log('X AutoPoster — OAuth 1.0a verify\n');
  const config = autoposter.getConfigStatus();
  console.log('Configured:', config.configured);
  console.log('Auth mode:', config.authMode);
  console.log('Target account:', config.account);

  const verify = await autoposter.verifyCredentials({ force: true });
  if (!verify.ok) {
    console.error('\nVerify FAILED:', verify.error);
    process.exit(1);
  }

  console.log('\nVerify OK');
  console.log('  Screen name: @' + verify.screenName);
  console.log('  User ID:', verify.userId);

  if (postText) {
    console.log('\nPosting test tweet…');
    const result = await autoposter.postTweet({ text: postText });
    console.log('Posted:', result.tweetUrl);
  } else {
    console.log('\nDry run only — pass --post "message" to send a live tweet.');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
