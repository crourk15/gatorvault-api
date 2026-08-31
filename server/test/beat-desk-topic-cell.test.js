'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBeatDesk() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin-hub-beat-desk.js'), 'utf8');
  const sandbox = {
    console,
    document: {
      createElement() {
        return {
          textContent: '',
          get innerHTML() {
            return String(this.textContent)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
          },
        };
      },
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(src, sandbox);
  return sandbox.GVAdminBeatDesk;
}

describe('Beat Desk TOPIC / PLAYER cell', () => {
  it('formats shouty promo titles and slug-like labels cleanly', () => {
    const desk = loadBeatDesk();
    assert.equal(desk.formatTopicLabel('JOIN GO', 'join-go', 'recruit'), 'Join Go');
    assert.equal(
      desk.formatTopicLabel('brother-martin-wr', 'brother-martin-wr', 'recruit'),
      'Brother Martin WR'
    );
    assert.equal(desk.formatTopicLabel('Jamarcus Johnson', 'jamarcus-johnson', 'recruit'), 'Jamarcus Johnson');
    assert.equal(desk.formatTopicLabel('Team news', 'uf-team-general', 'team'), 'Team news');
    assert.equal(desk.formatTopicLabel('CAMP DAY ONE', 'uf-team-camp', 'team'), 'Camp Day One');
    assert.equal(desk.formatTopicLabel('uf-program-facilities', 'uf-program-facilities', 'program'), 'Facilities');
    assert.equal(desk.formatTopicLabel('john_smith_qb', 'john_smith_qb', 'recruit'), 'John Smith QB');
  });

  it('renders stacked topic cell with kind chip (not status pill)', () => {
    const desk = loadBeatDesk();
    const teamHtml = desk.topicCellHtml('Team news', 'uf-team-general', 'team');
    assert.match(teamHtml, /hub-bd-topic/);
    assert.match(teamHtml, /hub-bd-topic__name/);
    assert.match(teamHtml, /hub-bd-topic__slug/);
    assert.match(teamHtml, /hub-bd-topic__kind--team/);
    assert.match(teamHtml, />TEAM</);
    assert.doesNotMatch(teamHtml, /hub-env-badge/);
    assert.match(teamHtml, /uf-team-general/);

    const playerHtml = desk.topicCellHtml('Jamarcus Johnson', 'jamarcus-johnson', 'recruit');
    assert.match(playerHtml, /hub-bd-topic__kind--recruit/);
    assert.match(playerHtml, />PLAYER</);
    assert.match(playerHtml, /Jamarcus Johnson/);
    assert.match(playerHtml, /jamarcus-johnson/);
  });

  it('wires CSS + cache-busted desk script in admin.html', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
    assert.match(html, /\.hub-bd-topic__main/);
    assert.match(html, /\.hub-bd-topic__kind--team/);
    assert.match(html, /\.hub-bd-topic__kind--player/);
    assert.match(html, /admin-hub-beat-desk\.js\?v=hub-bd-v18/);
  });
});
