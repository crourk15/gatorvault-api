/**
 * Every HP chase card On3 lead chrome must match store on3TopTeams favorite.
 * Surfaces: home / Lab / recruiting all use VaultChaseCard → topThreatVsFlorida.
 *
 * Run: npx tsx --test server/test/chase-on3-lead-audit.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { competingSchoolsFromRecruitingRecord } = require('../lib/underclassmen-intel.ts');
const { isUfGatorsSchool } = require('../lib/autoposter/rewrite/comp-sourcing.js');
const { topThreatVsFlorida } = require('../../client/components/futurecast/lab/competing-schools.ts');

const root = path.join(__dirname, '../..');

function loadPlayers() {
  return JSON.parse(fs.readFileSync(path.join(root, 'server/data/recruiting/players.json'), 'utf8'));
}

function loadHp(year = 2028) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, `server/data/recruiting/futurecast-runtime/high-priority-${year}.json`),
      'utf8'
    )
  );
}

function teamName(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.name || t.fullName || t.team?.name || '';
}

function shortLead(s) {
  const low = String(s || '').toLowerCase();
  if (isUfGatorsSchool(s)) return 'UF';
  if (low.includes('florida state') || low === 'fsu') return 'FSU';
  if (low.includes('ohio state')) return 'OSU';
  if (low.includes('alabama')) return 'ALA';
  if (low.includes('georgia tech')) return 'GT';
  if (low.includes('georgia')) return 'UGA';
  if (low.includes('miami')) return 'MIA';
  if (low.includes('clemson')) return 'CLEM';
  if (low.includes('notre dame')) return 'ND';
  if (low.includes('penn state')) return 'PSU';
  if (low.includes('tennessee')) return 'TENN';
  if (low.includes('auburn')) return 'AUB';
  if (low.includes('ole miss')) return 'MISS';
  if (low.includes('mississippi state')) return 'MSST';
  if (low.includes('south carolina')) return 'SC';
  if (low.includes('texas tech')) return 'TTU';
  if (low.includes('missouri')) return 'MIZ';
  if (low.includes('michigan state')) return 'MSU';
  if (low.includes('michigan')) return 'MICH';
  if (low.includes('smu')) return 'SMU';
  if (low.includes('nc state')) return 'NCSU';
  if (low.includes('stanford')) return 'STAN';
  if (low.includes('rutgers')) return 'RUT';
  if (low.includes('purdue')) return 'PUR';
  if (low.includes('kentucky')) return 'UK';
  if (low.includes('vanderbilt')) return 'VAN';
  return String(s).slice(0, 12) || '—';
}

function trueOn3Lead(top) {
  const rows = (top || [])
    .map((r) => ({
      school: teamName(r.team) || teamName(r) || r.school || '',
      pct: Number(r.prediction ?? r.odds ?? r.pct ?? 0),
    }))
    .filter((r) => r.school && r.pct > 0);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.pct));
  const scaled = rows.map((r) => ({ ...r, pct: max <= 1.5 ? r.pct * 100 : r.pct }));
  scaled.sort((a, b) => b.pct - a.pct);
  return { label: shortLead(scaled[0].school), school: scaled[0].school, pct: scaled[0].pct };
}

/** Same decision as VaultChaseCard on3LeadLabel. */
function chromeLead(player) {
  const threat = topThreatVsFlorida(player);
  const ufRpm =
    player.ufRpmPct != null && Number(player.ufRpmPct) > 0
      ? Math.round(Number(player.ufRpmPct))
      : null;
  if (threat && (ufRpm == null || threat.pct >= ufRpm)) {
    return shortLead(threat.name);
  }
  if (ufRpm != null && ufRpm > 0) return 'UF';
  if (threat) return shortLead(threat.name);
  return '—';
}

describe('isUfGatorsSchool excludes FSU family', () => {
  it('keeps Florida State / USF / FAU as non-UF', () => {
    assert.equal(isUfGatorsSchool('Florida'), true);
    assert.equal(isUfGatorsSchool('Florida Gators'), true);
    assert.equal(isUfGatorsSchool('Florida State'), false);
    assert.equal(isUfGatorsSchool('Florida State Seminoles'), false);
    assert.equal(isUfGatorsSchool('South Florida'), false);
    assert.equal(isUfGatorsSchool('Florida Atlantic'), false);
  });
});

describe('HP chase On3 lead chrome vs store on3TopTeams', () => {
  it('every 2028 HP card with On3 board matches chrome lead', () => {
    const list = loadPlayers();
    const bySlug = new Map(list.map((p) => [p.slug || p.id, p]));
    const hp = loadHp(2028);
    const mismatches = [];

    for (const row of hp.players || []) {
      const store = bySlug.get(row.slug);
      const top = store?.on3TopTeams || store?.topTeams;
      const truth = trueOn3Lead(top);
      if (!truth) continue;

      const chrome = chromeLead({
        ...row,
        competingSchools: row.competingSchools,
        ufRpmPct: row.ufRpmPct,
      });
      if (chrome !== truth.label) {
        mismatches.push({
          slug: row.slug,
          chrome,
          true: truth.label,
          truePct: truth.pct,
          ufRpm: row.ufRpmPct,
          peers: row.competingSchools,
        });
      }
    }

    assert.equal(
      mismatches.length,
      0,
      `On3 lead mismatches:\n${JSON.stringify(mismatches, null, 2)}`
    );
  });

  it('Tristian Henderson keeps Florida State as a peer (not stripped as UF)', () => {
    const list = loadPlayers();
    const store = list.find((p) => p.slug === 'tristian-henderson');
    assert.ok(store?.on3TopTeams?.length);
    const comps = competingSchoolsFromRecruitingRecord(store);
    const fsu = comps.find((c) => /florida state|fsu/i.test(c.name));
    assert.ok(fsu, `expected FSU in peers, got ${JSON.stringify(comps)}`);
    assert.ok(Number(fsu.pct) >= 15, fsu);
  });

  it('Joey Fleming chrome stays Alabama (~95) when mid rivals exist', () => {
    const player = {
      slug: 'joey-fleming',
      ufRpmPct: 7,
      competingSchools: [
        { name: 'Alabama', pct: 94.9 },
        { name: 'Auburn', pct: 18.6 },
      ],
    };
    const threat = topThreatVsFlorida(player);
    assert.ok(threat);
    assert.match(String(threat.name), /alabama/i);
    assert.equal(chromeLead(player), 'ALA');
  });
});
