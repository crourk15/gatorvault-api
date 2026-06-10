/**
 * Unit tests — recruiting auto-resolution mode.
 */
const auto = require('../lib/recruiting-auto-resolution');
const { isValidPlayerName } = require('../lib/x-autoposter-player-context');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

(async () => {
  assert('required field keys defined', auto.REQUIRED_FIELD_KEYS.length === 7);

  const missing = auto.listMissingRequiredFields({
    playerName: 'Jaylen Brown',
    pos: 'WR',
    stars: 4,
    classYear: 2027,
    highSchool: 'North Gwinnett HS',
    eventType: 'official_visit',
    detail: '2027 WR Jaylen Brown is set to visit Florida this weekend for an official visit.'
  });
  assert('complete record has no missing fields', missing.length === 0);

  const partial = auto.listMissingRequiredFields({ playerName: 'Jaylen Brown', eventType: 'official_visit' });
  assert('partial record lists missing fields', partial.includes('position') && partial.includes('rating'));

  const eventType = auto.resolveEventTypeFromText('2027 WR is set for an official visit to Florida this weekend');
  assert('classifies official visit event', eventType === 'official_visit');

  const unresolved = await auto.autoResolveRecruitingIntel({
    playerName: 'Xy Zq',
    playerSlug: 'xy-zq',
    beatText: 'visiting soon',
    eventType: null,
    allowContextual: false
  });
  assert('unresolvable intel returns needs_resolution', unresolved.needs_resolution === true);
  assert('unresolvable lists missing fields', Array.isArray(unresolved.missingFields) && unresolved.missingFields.length > 0);

  assert('invalid single token fails fullName check', !isValidPlayerName('Raheem'));

  if (process.exitCode) {
    console.error('\nRecruiting auto-resolution tests failed.');
  } else {
    console.log('\nAll recruiting auto-resolution tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
