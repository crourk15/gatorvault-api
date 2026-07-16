const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRecruitingFactClaims,
  loadPlayersSync,
} = require('../lib/insider-articles-recruiting-facts');

const FIXTURE_PLAYERS = [
  {
    name: 'Maxwell Hiller',
    slug: 'maxwell-hiller',
    status: 'committed',
    committedTo: 'Florida',
    category: 'recruit',
    classYear: 2027,
    pos: 'IOL',
  },
  {
    name: 'Amare Cobbins',
    slug: 'amare-cobbins',
    status: 'target',
    category: 'target',
    classYear: 2028,
    pos: 'TE',
    ufProbability: 0.07,
  },
  {
    name: 'Jaden Ballard',
    slug: 'jaden-ballard',
    status: 'target',
    category: 'target',
    classYear: 2028,
    pos: 'TE',
  },
];

describe('validateRecruitingFactClaims', () => {
  it('fails when UF commit is framed as still open / live closer', () => {
    const draft = {
      title: 'Heat Check',
      body: '<p>Maxwell Hiller is still open and remains a live closer for Florida this week.</p>',
      summary: 'Hiller live closer',
    };
    const reasons = validateRecruitingFactClaims(draft, FIXTURE_PLAYERS);
    assert.ok(
      reasons.some((r) => r.startsWith('fact_uf_commit_open_language:maxwell-hiller')),
      `expected open-language fail, got ${JSON.stringify(reasons)}`
    );
  });

  it('fails when uncommitted Ballard is treated as already in the class', () => {
    const draft = {
      title: 'Board note',
      body: '<p>Jaden Ballard is already in the class after a quiet spring.</p>',
    };
    const reasons = validateRecruitingFactClaims(draft, FIXTURE_PLAYERS);
    assert.ok(
      reasons.some((r) => r.startsWith('fact_open_player_treated_as_commit:jaden-ballard')),
      `expected open-as-commit fail, got ${JSON.stringify(reasons)}`
    );
  });

  it('accepts Program Pulse style with correct commit / long-shot / class year', () => {
    const draft = {
      title: 'Program Pulse',
      articleType: 'Program Pulse',
      category: 'program_pulse',
      summary: 'Roster churn and board closes share one clock.',
      thesis: 'Florida must stack portal math with board truth.',
      insiderAngles: [
        'Maxwell Hiller has been committed since April and anchors the IOL room.',
        'Amare Cobbins sits near ~7% as a long-shot TE add for the 2028 cycle.',
        'Jaden Ballard fits the 2028 TE blueprint if the staff keeps pressing visits.',
      ],
      body: [
        '<h2>Thesis</h2>',
        '<p>Florida is running roster churn and board closes on the same clock.</p>',
        '<h2>Insider Angles</h2>',
        '<p>Maxwell Hiller has been committed since April and anchors the IOL room.</p>',
        '<p>Amare Cobbins sits near ~7% as a long-shot TE add for the 2028 cycle.</p>',
        '<p>Jaden Ballard TE fit in the 2028 class remains a development play, not a locked pledge.</p>',
      ].join('\n'),
    };
    const reasons = validateRecruitingFactClaims(draft, FIXTURE_PLAYERS);
    const factFails = reasons.filter((r) => r.startsWith('fact_'));
    assert.deepEqual(factFails, [], `expected no fact fails, got ${JSON.stringify(factFails)}`);
  });

  it('fails battle cards that feature a UF commit', () => {
    const draft = {
      title: 'Battle card',
      body: '<p>Live battle update for the trenches.</p>',
      battles: [
        {
          targetName: 'Maxwell Hiller',
          slug: 'maxwell-hiller',
          copy: 'Committed prospect incorrectly slotted as a live battle.',
        },
      ],
    };
    const reasons = validateRecruitingFactClaims(draft, FIXTURE_PLAYERS);
    assert.ok(
      reasons.some((r) => r === 'fact_commit_in_live_battle:maxwell-hiller'),
      `expected battle commit fail, got ${JSON.stringify(reasons)}`
    );
  });

  it('fails class year mismatch near Cobbins when store is 2028', () => {
    const draft = {
      title: 'Class note',
      body: '<p>Amare Cobbins is a 2027 TE target Florida still wants on campus.</p>',
    };
    const reasons = validateRecruitingFactClaims(draft, FIXTURE_PLAYERS);
    assert.ok(
      reasons.some((r) => r === 'fact_class_year_mismatch:amare-cobbins:2028_vs_2027'),
      `expected class year mismatch, got ${JSON.stringify(reasons)}`
    );
  });


  it('fails Board focus live 2027 targets naming Cobbins (2028 store year)', () => {
    const draft = {
      title: 'Program Pulse',
      body: '<p>Board focus: 5 live 2027 targets — priority names: Ballard, Cobbins, Roberts.</p>',
    };
    const reasons = validateRecruitingFactClaims(draft, FIXTURE_PLAYERS);
    assert.ok(
      reasons.some((r) => r === 'fact_class_year_mismatch:amare-cobbins:2028_vs_2027'),
      `expected Cobbins class year mismatch near live 2027 targets, got ${JSON.stringify(reasons)}`
    );
  });

  it('loadPlayersSync can read live players.json without throwing', () => {
    const players = loadPlayersSync();
    assert.ok(Array.isArray(players));
  });
});
