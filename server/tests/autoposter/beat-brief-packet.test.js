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
    assert.match(text, /PLAYER PROJECTION \/ COMP/);
    assert.match(text, /PROJECTION \/ COMP RULE/);
    assert.match(text, /POST HEADER/);
    assert.match(text, /HEADER RULE/);
    assert.match(text, /ALWAYS required/);
    assert.match(text, /AGENT MUST DRAFT/);
    assert.match(text, /BODY SIZE|body size|within ~1/);
    assert.match(text, /GatorVault/);
    assert.match(text, /PERSIST RULE/);
    assert.match(text, /upsert-vault-film-eval/);
    assert.match(text, /Player projection:/);
    assert.match(text, /Player comp:/);
  });

  it('embeds War Room projection + player comp into the brief paste', () => {
    const mod = require('../../lib/beat-brief-packet');
    const text = mod.formatBriefText({
      slug: 'merrick-ham',
      playerName: 'Merrick Ham',
      player: {
        classYear: 2028,
        position: 'EDGE',
        stars: 4,
        status: 'uncommitted',
        ufStatus: 'Florida Offered',
      },
      research: {
        ufPosition: 'tracking',
        eventType: 'unofficial_visit',
        breakdown: {
          projection:
            'Ham projects as a developmental EDGE/OLB who wins the corner with length and hand counters.',
          comparison:
            'Ham comps to Josh Sweat — rangy length EDGE who wins with reach and strip pressure.',
          schemeFit: 'Ham fits a wide-9 / stand-up EDGE role.',
        },
      },
      beatRows: [],
      whyFlorida: 'Florida offered; tracking.',
      vaultAngle: 'Own Merrick Ham.',
      rivals: ['Auburn'],
    });

    assert.match(text, /PLAYER PROJECTION \/ COMP/);
    assert.match(text, /Projection: Ham projects as a developmental EDGE/);
    assert.match(text, /Player comp: Ham comps to Josh Sweat/);
    assert.match(text, /Scheme fit: Ham fits a wide-9/);
    assert.match(text, /PROJECTION \/ COMP RULE/);
    assert.match(text, /Structure:[\s\S]*GatorVault player comp with BODY SIZE match first/);
    assert.match(text, /HEADER RULE/);
    assert.match(text, /COMP SIZE RULE/);
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
    const desk = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'admin-hub-beat-desk.js'), 'utf8');
    assert.match(desk, /data-bd-open/);
    assert.match(desk, /Copy Brief/);
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
