const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectScaffoldBoilerplate,
  isEventFirstCategory,
} = require('../lib/insider-articles-elite-gate');

const PROGRAM_PULSE_DUMP = {
  title: 'Program Pulse: 2026 Florida roster architecture and culture check',
  category: 'program_pulse',
  articleType: 'Program Pulse',
  summary: 'Florida is running roster churn, scheme install, and board closes on the same clock — miss one, and September gets expensive.',
  thesis: 'Florida is running roster churn, scheme install, and board closes on the same clock — miss one, and September gets expensive.',
  insiderAngles: [
    'Board focus: 12 live 2027 targets — priority names: Ballard, Cobbins, Roberts.',
    'Intel desk: 4 verified signals in the latest window — use them to weight battles, not rumor.',
    'Scheme fit: 3-3-5 hybrid install puts JACK/STAR and trench depth under the brightest fall-camp spotlight.',
  ],
  body: [
    '<h2>Thesis</h2>',
    '<p>Florida is running roster churn, scheme install, and board closes on the same clock — miss one, and September gets expensive.</p>',
    '<h2>Insider Angles</h2>',
    '<p>Board focus: 12 live 2027 targets — priority names: Ballard, Cobbins, Roberts.</p>',
    '<p>Intel desk: 4 verified signals in the latest window.</p>',
    '<h2>Scheme Implications</h2>',
    '<p>The 3-3-5 hybrid asks three down linemen to eat doubles so hybrid defenders can play with leverage in space.</p>',
    '<p>JACK and STAR are the stress points against spread sets — cover-and-rush bodies win the install; substitution delays lose it.</p>',
    '<p>Offensively, protect the rebuilt OL with quick-game, play-action, and tempo until the trenches stabilize.</p>',
    '<h2>Analytics and Data</h2>',
    '<p>Heat desk: 0 rising prospects flagged this cycle — use that for closing urgency, not filler.</p>',
    '<h2>What\'s Next</h2>',
    '<p>Watch JACK/STAR and OL rep winners after the first fall scrimmage — that is the install report card.</p>',
    '<p>If the August install slips, explosive plays allowed and thin depth will show up by mid-October — not in December.</p>',
  ].join('\n'),
};

const WHITFIELD_STYLE = {
  title: "Heat Check: Florida's July CB double — Whitfield and Floyd",
  category: 'heat_check',
  articleType: 'Heat Check',
  summary: 'Jalen Whitfield and Jayden Floyd committed July 6 and July 7 — Maxwell Hiller remains locked.',
  thesis: 'Two July CB pledges reset the secondary board while Maxwell Hiller stays locked in the IOL room.',
  insiderAngles: [
    'Jalen Whitfield committed July 6 and locks a CB seat in the 2027 class.',
    'Jayden Floyd followed July 7 — Florida stacked a CB double inside 48 hours.',
    'Maxwell Hiller has been committed since April and remains locked on the IOL board.',
  ],
  body: [
    '<h2>Thesis</h2>',
    '<p>Jalen Whitfield committed July 6 and Jayden Floyd committed July 7 — a CB double that reshapes Florida\'s secondary board.</p>',
    '<p>Maxwell Hiller remains locked as a Florida commit in the IOL room.</p>',
    '<h2>Insider Angles</h2>',
    '<p>Whitfield\'s July 6 pledge gives UF a dated CB win, not a rumor spike.</p>',
    '<p>Floyd\'s July 7 follow-up stacked the room before fall camp visits heat up.</p>',
    '<p>Hiller stays locked — treat him as already in the class, not a live closer.</p>',
  ].join('\n'),
};

describe('detectScaffoldBoilerplate', () => {
  it('returns [] on empty draft', () => {
    assert.deepEqual(detectScaffoldBoilerplate({}), []);
    assert.deepEqual(detectScaffoldBoilerplate(null), []);
  });

  it('fails Program Pulse mad-lib dump with not_elite_scaffold_* reasons', () => {
    const reasons = detectScaffoldBoilerplate(PROGRAM_PULSE_DUMP);
    assert.ok(reasons.includes('not_elite_scaffold_program_pulse'), reasons);
    assert.ok(reasons.includes('not_elite_scaffold_scheme_dump'), reasons);
    assert.ok(reasons.includes('not_elite_scaffold_board_focus'), reasons);
    assert.ok(reasons.includes('not_elite_scaffold_heat_desk'), reasons);
    assert.ok(reasons.includes('not_elite_no_event_anchor'), reasons);
  });

  it('passes Whitfield-style body with July dates and locked Hiller (scaffold gate)', () => {
    const reasons = detectScaffoldBoilerplate(WHITFIELD_STYLE);
    const scaffoldFails = reasons.filter((r) => r.startsWith('not_elite_scaffold_') || r === 'not_elite_no_event_anchor');
    assert.deepEqual(scaffoldFails, [], `expected scaffold pass, got ${JSON.stringify(reasons)}`);
  });

  it('isEventFirstCategory recognizes heat_check and program_pulse', () => {
    assert.equal(isEventFirstCategory('heat_check'), true);
    assert.equal(isEventFirstCategory('program_pulse'), true);
    assert.equal(isEventFirstCategory('roster_analysis'), false);
  });
});