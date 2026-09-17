const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-trial-'));
process.env.GV_TRIAL_LEDGER_PATH = path.join(tmp, 'trial-ledger.json');

const {
  rememberTrial,
  markTrialDeleted,
  resolveRegistrationTrial,
  getTrialRecord,
  extendTrial,
} = require('../../lib/trial-ledger');

describe('trial-ledger', () => {
  afterEach(() => {
    try { fs.unlinkSync(process.env.GV_TRIAL_LEDGER_PATH); } catch {}
  });

  it('first registration gets a fresh 30-day window', () => {
    const plan = resolveRegistrationTrial('new@example.com', { trialDays: 30 });
    assert.equal(plan.reused, false);
    const ms = plan.trialEnd.getTime() - Date.now();
    assert.ok(ms > 29 * 86400000 && ms < 31 * 86400000);
  });

  it('delete + re-register keeps the original trialEnd', () => {
    const end = new Date('2026-08-01T00:00:00.000Z').toISOString();
    rememberTrial('fan@example.com', { trialEnd: end, trialStart: '2026-07-02T00:00:00.000Z' });
    markTrialDeleted('fan@example.com');
    const plan = resolveRegistrationTrial('fan@example.com', { trialDays: 30 });
    assert.equal(plan.reused, true);
    assert.equal(plan.priorDeleted, true);
    assert.equal(plan.trialEnd.toISOString(), end);
    assert.equal(getTrialRecord('fan@example.com').trialEnd, end);
  });

  it('extendTrial writes a new 30-day window for an expired email', () => {
    rememberTrial('mekeener50@gmail.com', {
      trialEnd: '2026-09-15T12:18:07.559Z',
      trialStart: '2026-08-16T12:18:07.559Z',
    });
    const now = new Date('2026-09-17T13:00:00.000Z');
    const row = extendTrial('mekeener50@gmail.com', { days: 30, now });
    assert.equal(row.days, 30);
    assert.equal(row.fromActiveWindow, false);
    assert.equal(row.trialEnd, '2026-10-17T13:00:00.000Z');
    assert.equal(getTrialRecord('mekeener50@gmail.com').trialEnd, '2026-10-17T13:00:00.000Z');
    assert.equal(getTrialRecord('mekeener50@gmail.com').trialStart, '2026-08-16T12:18:07.559Z');
  });
});
