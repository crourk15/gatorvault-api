const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateRewrite } = require('../../lib/autoposter/quality-checks');

describe('quality-checks', () => {
  it('rejects rewrite that is too similar', () => {
    const source = 'Easton Royal will visit UF.';
    const rewrite = 'Easton Royal will visit UF.';
    const result = validateRewrite(source, rewrite);
    assert.equal(result.ok, false);
    assert.ok(result.similarity > 0.2);
  });

  it('rejects rewrite that is too short', () => {
    const source = 'Easton Royal visit.';
    const rewrite = 'UF visit.';
    const result = validateRewrite(source, rewrite);
    assert.equal(result.ok, false);
    assert.equal(result.lengthOk, false);
  });

  it('accepts substantive insider rewrite', () => {
    const source = 'Easton Royal will take an official visit to UF June 11–13.';
    const rewrite =
      'UF staff quietly strengthened their position with Easton Royal, a 2027 WR the room is tracking with real momentum behind the scenes. The official visit window is the current inflection point as Florida builds traction in this recruitment. Billy Gonzales is heavily involved in the relationship layer. Projection: FutureCast puts UF at 70% — watch the summer decision timeline for the next clarity point on where this one is headed.';
    const result = validateRewrite(source, rewrite);
    assert.equal(result.ok, true);
    assert.equal(result.toneOk, true);
    assert.equal(result.contextOk, true);
  });
});
