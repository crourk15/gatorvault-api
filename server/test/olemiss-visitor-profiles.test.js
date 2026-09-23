const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { visitorsPanelForGameId } = require('../lib/game-week-visitors');
const store = require('../lib/recruiting-store');
const elite = require('../lib/recruiting-hub-elite');

const WATCHED = [
  'madoxx-davis',
  'jayden-bell',
  'giovanni-tuggle',
  'cj-craig-james',
  'jc-wessel',
  'shamar-evans',
  'ty-winn',
  'jaxon-flowers',
  'anthony-turner',
  'cooper-martenson',
  'domonic-williams-jr',
];

describe('Ole Miss visitor profiles', () => {
  it('puts the incomplete visitors in the store with pos / year / school / htWt', () => {
    const panel = visitorsPanelForGameId('olemiss');
    assert.ok(panel);
    const check = [...WATCHED, 'omari-lawson'];
    for (const slug of check) {
      const p = store.findBySlug(slug);
      assert.ok(p, `${slug} missing from recruiting store`);
      assert.ok(p.htWt, `${slug} missing htWt`);
      assert.ok(p.pos || p.position, `${slug} missing pos`);
      assert.ok(Number(p.classYear) >= 2027, `${slug} classYear`);
      assert.ok(p.school, `${slug} missing school`);
    }
    const lawson = store.findBySlug('omari-lawson');
    assert.equal(lawson.committedTo, 'Syracuse');
    assert.match(String(lawson.htWt), /6-6/);
    const tuggle = store.findBySlug('giovanni-tuggle');
    assert.equal(tuggle.committedTo, 'Ole Miss');
    const cooper = panel.visitors.find((v) => v.slug === 'cooper-martenson');
    assert.equal(cooper.stars, 3);
  });

  it('shows Vault Scouting after the Hudl sit for the incomplete visitors', () => {
    for (const slug of WATCHED) {
      const card = elite.getVaultScoutingForSlug(slug);
      assert.ok(card, `${slug} Vault Scouting hidden`);
      assert.ok(card.comparison, `${slug} missing comparison`);
      assert.ok(card.projection, `${slug} missing projection`);
      assert.ok(card.strengths.length >= 3, `${slug} missing strengths`);
    }
    assert.equal(elite.getVaultScoutingForSlug('omari-lawson'), null);
  });

  it('keeps fan Vault Scouting in complete sentences — no sit / Hudl shop-talk', () => {
    const shop = /sophomore sit|soph Hudl|\bHudl\b|tape is thin|not on this clip|this sit|this reel|this clip/i;
    const slugs = [
      ...WATCHED,
      'ryquan-butler',
      'easton-royal',
      'tatum-white',
      'malachi-lee',
      'jamarcus-johnson',
    ];
    for (const slug of slugs) {
      const card = elite.getVaultScoutingForSlug(slug);
      assert.ok(card, `${slug} Vault Scouting hidden`);
      assert.ok(!shop.test(card.evaluation), `${slug} evaluation shop-talk: ${card.evaluation}`);
      assert.ok(!shop.test(String(card.schemeFit || '')), `${slug} schemeFit shop-talk: ${card.schemeFit}`);
    }
    const martenson = elite.getVaultScoutingForSlug('cooper-martenson');
    assert.match(martenson.evaluation, /Martenson is a 6-5 \/ 285 tackle who/);
    assert.doesNotMatch(martenson.evaluation, /Pass-protection tape is thin/);
  });
});
