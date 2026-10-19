'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(
  path.join(__dirname, '../../client/lib/game-week-wow.css'),
  'utf8'
);

function block(selector) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, `missing selector ${selector}`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open, close + 1);
}

const bleed = block('.gv-gw-wow-page .fc-lab-bleed');
assert.match(bleed, /width:\s*100%/);
assert.doesNotMatch(bleed, /100vw/);

const row = block('.gv-gw-wow-row--2');
assert.match(row, /minmax\(0,\s*1fr\)/);

const swing = block('.gv-gw-swing-grid');
assert.match(swing, /minmax\(min\(220px,\s*100%\),\s*1fr\)/);

console.log('game-week-bleed: ok');
