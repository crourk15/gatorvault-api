import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { __scheduleApiTest, fallbackScheduleGames } from './schedule-api';
import { SCHEDULE_GAMES } from './schedule-data';

const { normalizeGames, mergeUniform } = __scheduleApiTest;

describe('schedule-api uniforms', () => {
  it('seed includes FAU helmet/jersey/pants for Game Week cold paint', () => {
    const fau = SCHEDULE_GAMES.find((g) => g.id === 'fau');
    assert.equal(fau?.uniform?.helmet, 'Orange');
    assert.equal(fau?.uniform?.jersey, 'Blue');
    assert.equal(fau?.uniform?.pants, 'White');
    assert.ok((fallbackScheduleGames().filter((g) => g.uniform).length || 0) >= 12);
  });

  it('normalizeGames keeps live uniform when present', () => {
    const live = normalizeGames([
      {
        id: 'fau',
        label: 'Sep 5 vs FAU',
        opp: 'FAU Owls',
        date: 'September 5, 2026 · 7:45 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 94,
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 38,
        predOpp: 10,
        uniform: {
          helmet: 'Blue',
          jersey: 'Blue',
          pants: 'Blue',
          label: 'All-Blue',
        },
      },
    ]);
    assert.equal(live[0]?.uniform?.label, 'All-Blue');
    assert.equal(live[0]?.uniform?.helmet, 'Blue');
  });

  it('normalizeGames backfills seed uniform when live row omits it', () => {
    const live = normalizeGames([
      {
        id: 'fau',
        label: 'Sep 5 vs FAU',
        opp: 'FAU Owls',
        date: 'September 5, 2026 · 7:45 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 94,
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 38,
        predOpp: 10,
      },
    ]);
    assert.equal(live[0]?.uniform?.label, 'Orange / Blue / White');
    assert.equal(live[0]?.uniform?.helmet, 'Orange');
  });

  it('normalizeGames keeps live final and box when present', () => {
    const live = normalizeGames([
      {
        id: 'fau',
        label: 'Sep 5 vs FAU',
        opp: 'FAU Owls',
        date: 'September 5, 2026 · 7:45 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 94,
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 38,
        predOpp: 10,
        finalUF: 66,
        finalOpp: 21,
        finalSource: 'official',
        boxScoreUrl: 'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903',
      },
    ]);
    assert.equal(live[0]?.finalUF, 66);
    assert.equal(live[0]?.finalOpp, 21);
    assert.equal(live[0]?.finalSource, 'official');
    assert.match(String(live[0]?.boxScoreUrl), /boxscore\/27903/);
  });

  it('normalizeGames backfills seed final and box when live row omits them', () => {
    const live = normalizeGames([
      {
        id: 'fau',
        label: 'Sep 5 vs FAU',
        opp: 'FAU Owls',
        date: 'September 5, 2026 · 7:45 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 94,
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 38,
        predOpp: 10,
      },
    ]);
    assert.equal(live[0]?.finalUF, 66);
    assert.equal(live[0]?.finalOpp, 21);
    assert.equal(live[0]?.finalSource, 'official');
    assert.match(String(live[0]?.boxScoreUrl), /boxscore\/27903/);
  });

  it('normalizeGames does not refill desk scout from seed when API sends empty arrays', () => {
    const seed = SCHEDULE_GAMES.find((g) => g.id === 'campbell');
    assert.ok(seed?.offenseScout?.some((n) => /Film-confirmed/i.test(n)));
    const live = normalizeGames([
      {
        id: 'campbell',
        label: 'Sep 12 vs Campbell',
        opp: 'Campbell Fighting Camels',
        date: 'September 12, 2026 · 7:00 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 90,
        keys: [],
        swing: [],
        film: 'What the tape shows vs Campbell.',
        pred: '',
        predUF: 45,
        predOpp: 10,
        offenseScout: [],
        defenseScout: [],
      },
    ]);
    assert.deepEqual(live[0]?.offenseScout, []);
    assert.deepEqual(live[0]?.defenseScout, []);
    assert.equal(live[0]?.scoutingReport, undefined);
  });

  it('normalizeGames does not refill desk scout when API omits the fields', () => {
    const live = normalizeGames([
      {
        id: 'campbell',
        label: 'Sep 12 vs Campbell',
        opp: 'Campbell Fighting Camels',
        date: 'September 12, 2026 · 7:00 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 90,
        keys: [],
        swing: [],
        film: 'What the tape shows vs Campbell.',
        pred: '',
        predUF: 45,
        predOpp: 10,
      },
    ]);
    assert.equal(live[0]?.offenseScout, undefined);
    assert.equal(live[0]?.defenseScout, undefined);
    assert.equal(live[0]?.scoutingReport, undefined);
  });

  it('normalizeGames keeps a sat Matchup Edge stamp', () => {
    const live = normalizeGames([
      {
        id: 'olemiss',
        label: 'Sep 26 vs Ole Miss',
        opp: 'Ole Miss Rebels',
        date: 'September 26, 2026 · 3:30 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 51,
        keys: [],
        swing: [],
        radar: [{ label: 'Front 7', uf: 72, opp: 48 }],
        film: '',
        pred: '',
        predUF: 28,
        predOpp: 27,
      },
    ]);
    assert.deepEqual(live[0]?.radar, [{ label: 'Front 7', uf: 72, opp: 48 }]);
  });

  it('normalizeGames prefers a firm seed kickoff over a live window', () => {
    const live = normalizeGames([
      {
        id: 'olemiss',
        label: 'Sep 26 vs Ole Miss',
        opp: 'Ole Miss Rebels',
        date: 'September 26, 2026 · 3:30–8:00 PM ET',
        venue: 'Ben Hill Griffin Stadium, Gainesville FL',
        ufPct: 51,
        tv: 'TBD',
        keys: [],
        swing: [],
        film: '',
        pred: '',
        predUF: 28,
        predOpp: 27,
      },
    ]);
    assert.equal(live[0]?.date, 'September 26, 2026 · 3:30 PM ET');
    assert.equal(live[0]?.tv, 'ABC');
  });

  it('mergeUniform prefers live over seed', () => {
    const merged = mergeUniform(
      { helmet: 'Blue', jersey: 'Blue', pants: 'Blue', label: 'All-Blue' },
      { helmet: 'Orange', jersey: 'Blue', pants: 'White', label: 'Orange / Blue / White' }
    );
    assert.equal(merged?.label, 'All-Blue');
  });
});
