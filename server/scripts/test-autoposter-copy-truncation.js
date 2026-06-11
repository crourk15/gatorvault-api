/**
 * Autoposter copy — no mid-sentence truncation or broken URL fragments.
 */
const template = require('../lib/x-autoposter-template');
const playerContext = require('../lib/x-autoposter-player-context');
const copy = require('../lib/x-autoposter-copy');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

async function main() {
  const threadBeat =
    "Here's an official visit update thread for the June 11–15 weekend with several UF targets on campus per @GatorsOnline.";
  const urlBeat =
    'INTEL: https://www.on3.com/sites/florida-gators/board/official-visit-weekend-thread loaded with updates from Gainesville.';

  assert('thread beat is recruiting discussion', template.disableEllipsisForCopy({ beatText: threadBeat }));

  const teamBuilt = playerContext.buildTeamEventPost({
    beatText: threadBeat,
    source: 'Gators Online',
    teamEventType: 'general'
  });
  assert('team event general produces text', teamBuilt?.text);
  assert('team event no ellipsis', !teamBuilt.text.includes('…'));
  assert('team event ends with punctuation', /[.!?]\s*$/.test(teamBuilt.text.split('\n').pop().trim()));

  const urlBuilt = playerContext.buildProgramNewsPost({
    beatText: urlBeat,
    source: 'On3',
    programNewsType: 'general'
  });
  assert('program news with URL produces text', urlBuilt?.text);
  assert('program news strips broken htt fragment', !/\bhtt\b/i.test(urlBuilt.text));
  assert('program news no ellipsis', !urlBuilt.text.includes('…'));

  const sanitized = template.sanitizeCopyLine(
    "INTEL: https://example.com/very/long/path/to/recruiting/thread/article?ref=abc here's the update.",
    120,
    { triggerType: 'program_news', beatText: urlBeat }
  );
  assert('sanitize removes raw URL or shortens', !/https:\/\/example\.com\/very\/long/.test(sanitized));
  assert('sanitize completes sentence', template.endsCompleteSentence(sanitized));

  const incomplete = template.ensureCompleteSentence('Florida announced a June 11–1');
  assert('incomplete date range gets fallback closure', incomplete.includes('Full details via the original report.'));
  assert('broken ending detected', template.hasBrokenEnding('INTEL: htt'));
  assert('isTruncatedCopy catches ellipsis', template.isTruncatedCopy('Some line that cuts off mid wor…'));

  const built = await copy.buildProgramNewsCopyAsync({
    text: urlBeat,
    writerName: 'On3',
    url: 'https://www.on3.com/sites/florida-gators/'
  });
  assert('buildProgramNewsCopyAsync ok', built?.text);
  assert('built copy passes isBrokenCopy', built && !copy.isBrokenCopy(built.text, built));

  if (process.exitCode) {
    console.error('\nCopy truncation tests failed.');
    process.exit(1);
  }
  console.log('\nAll copy truncation tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
