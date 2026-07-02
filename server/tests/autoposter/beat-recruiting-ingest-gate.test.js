const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../../lib/beat-recruiting-ingest-gate');
const { parseBeatPostForVisitIntel } = require('../../lib/beat-writer-ingest');

const GOOD_POST = {
  text: '2028 WR Easton Royal will take an official visit to Florida from June 11–13.',
  handle: 'ttjharden8',
  writerName: 'Tyler Harden',
  publishedAt: '2026-06-10T12:00:00.000Z',
  id: 'test-easton-ov',
};

describe('beat-recruiting-ingest-gate', () => {
  it('passes a valid 2028 UF recruiting beat tweet', () => {
    const result = gate.evaluateStrictRecruitingIngestGate(GOOD_POST);
    assert.equal(result.pass, true);
  });

  it('rejects disallowed accounts', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      handle: 'randomreporter',
      writerName: 'Random Reporter',
    });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'disallowed_account');
  });

  it('allows posts without explicit class year when other gates pass', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: 'WR Easton Royal will take an official visit to Florida from June 11–13.',
    });
    assert.equal(result.pass, true);
  });

  it('rejects posts with explicit class year 2026', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2026 WR Easton Royal commits to Florida.',
    });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'class_year_below_2027');
  });

  it('rejects posts with explicit class year 2029', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2029 WR Easton Royal will take an official visit to Florida.',
    });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'class_year_below_2027');
  });

  it('allows 2028 recruiting intel', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2028 WR Phoenix Evans will take an official visit to Florida this weekend.',
    });
    assert.equal(result.pass, true);
  });

  it('does not reject mixed-class headlines solely for mentioning 2027', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: 'Florida Gators Recruiting: 2027 DB Battles Heat Up + First 2028 Commit Lands',
    });
    assert.notEqual(result.reason, 'class_year_below_2027');
  });

  it('passes camp-visit intel with class, position, and player name', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      handle: 'ttjharden8',
      writerName: 'Tyler Harden',
      text:
        'Woodward Academy (GA) 2028 DL Tory Clark was in the Swamp for Friday Night Lights on June 19. Along with the connections he made with the Gators, he also has a unique connection at Florida. My recruitment is still open.',
    });
    assert.equal(result.pass, true);
  });

  it('rejects posts without UF mention or locked target name', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2027 WR John Smith will take an official visit to Texas from June 11–13.',
    });
    assert.equal(result.pass, false);
    assert.ok(['no_uf_mention', 'missing_uf_context', 'other_program_without_uf'].includes(result.reason));
  });

  it('rejects posts without a player name', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2028 recruiting class visit weekend for Florida football.',
    });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'no_player_name');
  });

  it('allows UF official accounts', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      handle: 'GatorsFB',
      writerName: 'Florida Gators Football',
      outlet: 'UF Official',
    });
    assert.equal(result.pass, true);
  });

  it('parseBeatPostForVisitIntel uses strict gate', () => {
    const row = parseBeatPostForVisitIntel(GOOD_POST, { logSkips: false });
    assert.ok(row);
    assert.equal(row.playerName, 'Easton Royal');
    assert.equal(row.classYear, 2028);
  });

  it('extracts player names with suffixes and POS prefixes', () => {
    const copy = require('../../lib/x-autoposter-copy');
    assert.equal(copy.extractPlayerFromText('2028 RB Lorenzo McMullen Jr. will visit Florida.'), 'Lorenzo McMullen Jr');
    assert.equal(copy.extractPlayerFromText('2028 WR Davin Davidson is set for an OV to Gainesville.'), 'Davin Davidson');
    assert.equal(copy.extractPlayerFromText('RB Hudson West has Florida in his top five.'), 'Hudson West');
  });

  it('parseBeatPostForVisitIntel drops generic beat fluff', () => {
    const row = parseBeatPostForVisitIntel(
      {
        text: 'Big recruiting weekend ahead for the Gators.',
        handle: 'ttjharden8',
        writerName: 'Tyler Harden',
      },
      { logSkips: false }
    );
    assert.equal(row, null);
  });
});
