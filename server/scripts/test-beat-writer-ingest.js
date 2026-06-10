/**
 * Unit tests — beat-writer-ingest visit parsing (no network).
 */
const ingest = require('../lib/beat-writer-ingest');
const cancelParser = require('../lib/beat-visit-intel-parser');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const benderPost = {
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3',
  text: '2027 4-star WR Jalen Brewster is set to officially visit Florida this weekend, sources tell @GatorsOnline.',
  publishedAt: '2026-06-05T14:00:00.000Z',
  url: 'https://x.com/Corey_Bender/status/1'
};

const parsed = ingest.parseBeatPostForVisitIntel(benderPost);
assert('parses official visit from Bender', parsed && parsed.eventType === 'official_visit');
assert('extracts Jalen Brewster', parsed && parsed.playerName === 'Jalen Brewster');
assert('extracts class year 2027', parsed && parsed.classYear === 2027);
assert('extracts visit date this weekend', parsed && parsed.visitStart === 'this weekend');

const hardenPost = {
  handle: 'ttjharden8',
  writerName: 'Tyler Harden',
  text: '2026 LB Marcus Jones was on campus in Gainesville today for an unofficial visit with Florida staff.',
  publishedAt: '2026-06-05T15:00:00.000Z',
  url: 'https://x.com/ttjharden8/status/2'
};
const hardenParsed = ingest.parseBeatPostForVisitIntel(hardenPost);
assert('parses on-campus visit from Harden', hardenParsed && hardenParsed.eventType === 'unofficial_visit');

const cancelPost = {
  handle: 'Hayesfawcett3',
  writerName: 'Hayes Fawcett',
  text: 'Amare Patterson has cancelled his OV to Florida and will visit South Carolina this weekend.',
  publishedAt: '2026-06-05T16:00:00.000Z'
};
assert('skips OV cancel posts', !ingest.parseBeatPostForVisitIntel(cancelPost));
assert('cancel parser still catches cancels', cancelParser.isVisitCancelPost(cancelPost.text));

const randomPost = {
  handle: 'randomuser',
  writerName: 'Random',
  text: '2027 QB Some Player set to visit Florida this weekend.',
  publishedAt: '2026-06-05T17:00:00.000Z'
};
assert('rejects untrusted writer', !ingest.parseBeatPostForVisitIntel(randomPost));

if (process.exitCode) {
  console.error('\nBeat writer ingest tests failed.');
} else {
  console.log('\nAll beat writer ingest tests passed.');
}
