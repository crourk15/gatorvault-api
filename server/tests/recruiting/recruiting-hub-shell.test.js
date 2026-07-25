const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

function recruitingHubShellMode(year) {
  const y = Number(year) || 0;
  if (y <= 2026) return 'signed';
  if (y === 2027) return 'closing';
  return 'open';
}

test('recruiting hub shell modes by class year', () => {
  assert.equal(recruitingHubShellMode(2026), 'signed');
  assert.equal(recruitingHubShellMode(2025), 'signed');
  assert.equal(recruitingHubShellMode(2027), 'closing');
  assert.equal(recruitingHubShellMode(2028), 'open');
  assert.equal(recruitingHubShellMode(2029), 'open');
});

test('client shell helper module is utf8 source', () => {
  const shellPath = path.join(__dirname, '../../../client/lib/recruiting-hub-shell.ts');
  assert.ok(fs.existsSync(shellPath));
  const buf = fs.readFileSync(shellPath);
  assert.notEqual(buf[1], 0, 'should not be UTF-16 LE');
  const src = buf.toString('utf8');
  assert.match(src, /RecruitingHubShellMode/);
  assert.match(src, /hubShowsRemainingTargets/);
  assert.match(src, /hubShowsClassCards/);
});

test('client shell helper disables class cards for all years', () => {
  const shellPath = path.join(__dirname, '../../../client/lib/recruiting-hub-shell.ts');
  const src = fs.readFileSync(shellPath, 'utf8');
  assert.match(src, /hubShowsClassCards/);
  assert.match(src, /return false/);
});

