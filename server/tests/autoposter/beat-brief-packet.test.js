'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Beat Brief Desk', () => {
  it('exports buildBeatBrief and formats paste text', () => {
    const mod = require('../../lib/beat-brief-packet');
    assert.equal(typeof mod.buildBeatBrief, 'function');
    assert.equal(typeof mod.formatBriefText, 'function');

    const text = mod.formatBriefText({
      slug: 'hudson-west',
      playerName: 'Hudson West',
      player: {
        classYear: 2028,
        position: 'QB',
        stars: 4,
        school: 'IMG Academy',
        state: 'FL',
        ufProbability: 0.59,
        competingSchools: ['Georgia', 'Alabama'],
      },
      inspect: {
        fullCompose: { ok: true, text: 'Sample draft for Hudson West.' },
      },
      beatRows: [
        {
          reportedAt: '2026-07-28T12:00:00.000Z',
          source: 'beat-writer',
          detail: 'Florida offered Hudson West and is pushing hard.',
          articleUrl: 'https://example.com/story',
        },
      ],
    });

    assert.match(text, /GATORVAULT BEAT BRIEF/);
    assert.match(text, /Hudson West/);
    assert.match(text, /Class: 2028/);
    assert.match(text, /UF likelihood: 59%/);
    assert.match(text, /BEAT INTEL/);
    assert.match(text, /Florida offered Hudson West/);
    assert.match(text, /INSTRUCTIONS FOR AI/);
    assert.match(text, /Sample draft for Hudson West/);
  });

  it('wires Beat Desk into Admin Hub nav + scripts', () => {
    const core = fs.readFileSync(
      path.join(__dirname, '..', '..', 'js', 'admin-hub-core.js'),
      'utf8'
    );
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'admin.html'), 'utf8');
    const routes = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'x-autoposter-routes.js'),
      'utf8'
    );
    assert.match(core, /id: 'beat-desk'/);
    assert.match(core, /GVAdminBeatDesk/);
    assert.match(core, /#beat-desk\/desk/);
    assert.match(html, /admin-hub-beat-desk\.js/);
    assert.match(routes, /post-studio\/brief\/:slug/);
  });

  it('QA monitor is hourly with soft-fail support', () => {
    const yml = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'qa-monitor.yml'),
      'utf8'
    );
    const runner = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'run-qa-crawler.js'),
      'utf8'
    );
    assert.match(yml, /cron: '17 \* \* \* \*'/);
    assert.doesNotMatch(yml, /\*\/5 \* \* \* \*/);
    assert.match(yml, /QA_SOFT_FAIL_IDS/);
    assert.match(runner, /soft-only failures/);
  });
});
