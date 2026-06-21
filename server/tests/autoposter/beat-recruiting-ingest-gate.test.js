const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../../lib/beat-recruiting-ingest-gate');
const { parseBeatPostForVisitIntel } = require('../../lib/beat-writer-ingest');

const GOOD_POST = {
  text: '2027 WR Easton Royal will take an official visit to Florida from June 11–13.',
  handle: 'ttjharden8',
  writerName: 'Tyler Harden',
  publishedAt: '2026-06-10T12:00:00.000Z',
  id: 'test-easton-ov',
};

describe('beat-recruiting-ingest-gate', () => {
  it('passes a valid 2027 UF recruiting beat tweet', () => {
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

  it('rejects posts without class year 2027+', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2026 WR Easton Royal commits to Florida.',
    });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'class_year_below_2027');
  });

  it('rejects posts without UF mention', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2027 WR Easton Royal will take an official visit to Texas from June 11–13.',
    });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'no_uf_mention');
  });

  it('rejects posts without a player name', () => {
    const result = gate.evaluateStrictRecruitingIngestGate({
      ...GOOD_POST,
      text: '2027 recruiting class visit weekend for Florida football.',
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
    assert.equal(row.classYear, 2027);
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
