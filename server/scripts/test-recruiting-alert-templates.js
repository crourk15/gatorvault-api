#!/usr/bin/env node
const assert = require('assert');
const t = require('../lib/recruiting-alert-templates');

const player = {
  name: 'Jalen Brewster',
  pos: 'DL',
  stars: 5,
  committedTo: 'Texas Tech',
  natlRank: 42
};

const skinny = t.buildSkinnyAlert({
  player,
  eventType: 'official_visit',
  row: { visitStart: new Date(Date.now() + 3 * 86400000).toISOString() }
});
assert(!/@\w/.test(skinny), 'skinny should not contain handles');
assert(!/vip/i.test(skinny), 'skinny should not contain VIP');
assert(/official visit to Florida/i.test(skinny), 'skinny should describe OV');
assert(/Jalen Brewster/.test(skinny), 'skinny should include name');

const note = t.buildProfileNote({
  player,
  existing: { ufOvStatus: 'visit' },
  eventType: 'official_visit',
  row: { detail: 'he tells @Swamp_247 VIP link https://x.com/foo' }
});
assert(!/@\w/.test(note), 'profile note should not contain handles');
assert(!/https?:/i.test(note), 'profile note should not contain links');
assert(!/tells/i.test(note), 'profile note should not contain attribution');
assert(/Texas Tech commit Jalen Brewster/.test(note), 'profile note should use commit prefix');
assert(/priority DL target/i.test(note), 'profile note should include priority + pos');

console.log('OK recruiting alert templates');
console.log('Skinny:', skinny);
console.log('Note:', note);
