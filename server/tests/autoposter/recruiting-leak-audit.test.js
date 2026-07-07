const test = require('node:test');
const assert = require('node:assert/strict');

const leakAudit = require('../../lib/autoposter/recruiting-leak-audit');

test('classifyLeakText detects PR6 fallback phrases', () => {
  assert.equal(
    leakAudit.classifyLeakText('Florida gave Florida a foothold in his recruitment.'),
    'pr6_fallback'
  );
  assert.equal(
    leakAudit.classifyLeakText('Building real traction with Smith early in his recruitment.'),
    'pr6_fallback'
  );
  assert.equal(leakAudit.classifyLeakText('Sumrall offered after the FNL visit.'), null);
});

test('auditQueueItems flags recruiting queue leaks and trace mode', () => {
  const prev = process.env.X_AUTOPOST_PR789_ONLY_RECRUITING;
  process.env.X_AUTOPOST_PR789_ONLY_RECRUITING = 'true';
  try {
    const clean = leakAudit.auditQueueItems([
      {
        id: 'ok1',
        text: 'Cale Britt - 2028 QB\nSumrall offered after elite FNL visit.',
        topic: 'recruiting',
        playerSlug: 'cale-britt',
        status: 'pending'
      }
    ]);
    assert.equal(clean.violations.length, 0);
    assert.equal(clean.scanned, 1);

    const leaked = leakAudit.auditQueueItems([
      {
        id: 'bad1',
        text: 'Britt gave Florida a foothold early in the cycle.',
        topic: 'recruiting',
        playerSlug: 'cale-britt',
        status: 'pending'
      },
      {
        id: 'bad2',
        text: 'Elite path',
        topic: 'recruiting',
        playerSlug: 'merrick-ham',
        status: 'hub_review',
        validationMeta: { trace: { mode: 'n2_pr6_fallback' } }
      }
    ]);
    assert.equal(leaked.violations.length, 2);
    assert.ok(leaked.violations.some((v) => v.leakTypes.includes('pr6_fallback')));
    assert.ok(leaked.violations.some((v) => v.leakTypes.includes('n2_pr6_fallback')));
  } finally {
    if (prev == null) delete process.env.X_AUTOPOST_PR789_ONLY_RECRUITING;
    else process.env.X_AUTOPOST_PR789_ONLY_RECRUITING = prev;
  }
});

test('auditSentLedger scans recruiting sent posts for leaks', () => {
  const out = leakAudit.auditSentLedger([
    {
      playerSlug: 'cale-britt',
      text: 'UF put UF on his board early in this cycle.',
      sentAt: new Date().toISOString(),
      tweetId: 't1'
    },
    {
      playerSlug: 'zyon-robinson',
      text: 'Robinson left The Swamp with a staff pitch on record.',
      sentAt: new Date().toISOString(),
      tweetId: 't2'
    }
  ]);
  assert.equal(out.scanned, 2);
  assert.equal(out.violations.length, 1);
  assert.equal(out.violations[0].leakTypes[0], 'pr6_fallback');
});

test('runRecruitingLeakAudit returns G4 envelope', () => {
  const report = leakAudit.runRecruitingLeakAudit();
  assert.equal(report.ok, true);
  assert.equal(report.gate, 'G4');
  assert.equal(typeof report.pass, 'boolean');
  assert.equal(typeof report.leakCount, 'number');
  assert.ok(report.auditedAt);
});