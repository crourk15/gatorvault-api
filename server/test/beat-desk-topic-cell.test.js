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
  });

  it('renders stacked topic cell with kind chip (not status pill)', () => {
    const desk = loadBeatDesk();
    const html = desk.topicCellHtml('Team news', 'uf-team-general', 'team');
    assert.match(html, /hub-bd-topic/);
    assert.match(html, /hub-bd-topic__name/);
    assert.match(html, /hub-bd-topic__slug/);
    assert.match(html, /hub-bd-topic__kind--team/);
    assert.match(html, />TEAM</);
    assert.doesNotMatch(html, /hub-env-badge/);
    assert.match(html, /uf-team-general/);
  });

  it('wires CSS + cache-busted desk script in admin.html', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
    assert.match(html, /\.hub-bd-topic__main/);
    assert.match(html, /\.hub-bd-topic__kind--team/);
    assert.match(html, /admin-hub-beat-desk\.js\?v=hub-bd-v17/);
  });
});
