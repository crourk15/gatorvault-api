/**
 * HP chase card enrich — visit lines + note preview from intel (API-only).
 * Run: node --test server/test/hp-chase-card-enrich.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_VISIT_DAYS,
  buildVisitHistoryFromLogs,
  filterStaleChaseVisitHistory,
  pickChaseNotePreview,
  processFreshnessNudge,
  enrichHighPriorityChaseCards,
  looksLikeTraitOrRankPlate,
} = require('../lib/hp-chase-card-enrich');

describe('hp-chase-card-enrich', () => {
  it('defaults Chase visit window to Board Intel (~21d)', () => {
    assert.equal(DEFAULT_VISIT_DAYS, 21);
  });

  it('builds UV / OV / Home visit labels from Florida visit logs only', () => {
    const logs = [
      {
        playerSlug: 'hudson-west',
        school: 'Florida',
        visitType: 'unofficial_visit',
        date: '2026-08-10',
      },
      {
        playerSlug: 'hudson-west',
        school: 'Georgia',
        visitType: 'unofficial_visit',
        date: '2026-08-10',
      },
      {
        playerSlug: 'hudson-west',
        school: 'Florida',
        visitType: 'home_visit',
        date: '2026-08-12',
      },
      {
        playerSlug: 'hudson-west',
        school: 'Florida',
        visitType: 'unofficial_visit',
        date: '2026-06-19',
      },
      {
        playerSlug: 'other-kid',
        school: 'Florida',
        visitType: 'unofficial_visit',
        date: '2026-08-10',
      },
    ];
    const badges = buildVisitHistoryFromLogs('hudson-west', logs, {
      nowMs: Date.parse('2026-08-18T12:00:00Z'),
    });
    assert.ok(badges.some((b) => /Home visit/i.test(b.label)));
    assert.ok(badges.some((b) => /^UV/i.test(b.label) || b.type === 'UV'));
    assert.ok(!badges.some((b) => /Georgia/i.test(b.label)));
    assert.ok(!badges.some((b) => /Jun 19/i.test(b.label)), 'June camp UV must age off');
  });

  it('filterStaleChaseVisitHistory drops old UV plates but keeps Expected', () => {
    const kept = filterStaleChaseVisitHistory(
      [
        { type: 'UV', label: 'UV · Jun 19' },
        { type: 'UV', label: 'UV · Aug 10' },
        { type: 'Game Day', label: 'Expected FAU visit · Sep 5' },
      ],
      { nowMs: Date.parse('2026-08-18T12:00:00Z') }
    );
    assert.deepEqual(
      kept.map((b) => b.label),
      ['UV · Aug 10', 'Expected FAU visit · Sep 5']
    );
  });

  it('prefers chase process notes over rank-plate skinny', () => {
    assert.equal(looksLikeTraitOrRankPlate('4★ DL · #50 natl · Toombs County'), true);
    const preview = pickChaseNotePreview({
      skinny: '4★ DL · #50 natl · Toombs County (Lyons, GA)',
      profileNote: 'UF offered last month and making a massive push; feels like a top target',
      intelRows: [],
    });
    assert.match(String(preview), /massive push|top target/i);
  });

  it('falls back to intel status when profile note is empty', () => {
    const preview = pickChaseNotePreview({
      skinny: '4★ EDGE · #102 natl · Marietta, GA',
      profileNote: '',
      intelRows: [
        {
          reportedAt: '2026-08-13T13:42:17.042Z',
          status: 'Jamarcus Johnson — Florida offer on file (2026-08-13). Continuous allowlist intel sweep.',
        },
      ],
    });
    assert.match(String(preview), /Florida offer/i);
    assert.doesNotMatch(String(preview), /Continuous allowlist/i);
  });

  it('nudges priority from visits/intel without touching delta7d', () => {
    const nudge = processFreshnessNudge(
      { chase: { flOffers: 1, pursuit: 1 } },
      {
        visitHistory: [{ type: 'UV', label: 'UV · Jun 19' }],
        intelRows: [{ reportedAt: '2026-08-10T00:00:00Z' }],
        nowMs: Date.parse('2026-08-18T12:00:00Z'),
      }
    );
    assert.ok(nudge > 0);
    assert.ok(nudge <= 4.5);
  });


  it('loads recruiting map once — never N× findBySlug on enrich', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'lib', 'hp-chase-card-enrich.js'),
      'utf8'
    );
    assert.match(src, /loadRecruitingBySlugMap/);
    assert.match(src, /ONE players\.json parse/);
    assert.doesNotMatch(
      src,
      /for \(const p of players[\s\S]*findBySlug/
    );
  });

  it('enrichHighPriorityChaseCards fills visitHistory + notePreview and keeps delta7d', () => {
    const players = enrichHighPriorityChaseCards(
      [
        {
          slug: 'hudson-west',
          name: 'Hudson West',
          priorityScore: 50,
          hotScore: 50,
          delta7d: 0,
          chase: { flOffers: 1, uv: 2 },
        },
      ],
      {
        nowMs: Date.parse('2026-08-18T12:00:00Z'),
        visitLogs: [
          {
            playerSlug: 'hudson-west',
            school: 'Florida',
            visitType: 'unofficial_visit',
            date: '2026-08-10',
          },
        ],
        recruitingBySlug: new Map([
          [
            'hudson-west',
            {
              skinny: 'QB · Sarasota · UF offer · feels like top target',
              profileNote: 'Sarasota QB — UF offered last month and making a massive push',
            },
          ],
        ]),
        intelBySlug: new Map(),
      }
    );
    const p = players[0];
    assert.ok(Array.isArray(p.visitHistory) && p.visitHistory.length >= 1);
    assert.match(String(p.visitHistory[0].label), /UV|Expected|Home|OV/i);
    assert.match(String(p.notePreview), /push|offer/i);
    assert.equal(p.delta7d, 0);
    assert.ok(p.priorityScore >= 50);
  });
});
