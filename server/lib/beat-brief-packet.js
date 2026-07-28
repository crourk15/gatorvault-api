/**
 * Beat Brief Desk — paste-ready player/UF research packet for Charles → Cursor/Copilot → X.
 * Fuses beat writers + recruiting store + elite research so every Open yields a full UF angle.
 */
const intelStore = require('./recruiting-intel-store');

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function line(label, value) {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

function pct(n) {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  if (num <= 1) return `${Math.round(num * 100)}%`;
  return `${Math.round(num)}%`;
}

function daysAgo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

async function loadRecruitingPlayer(slug) {
  try {
    const store = require('./recruiting-store');
    return (await store.getPlayerBySlug(slug)) || null;
  } catch {
    return null;
  }
}

function rivalList(player = {}, research = null, intelligence = null) {
  const fromResearch = (research?.topSchools || research?.on3TopTeams || [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.school || s?.team || ''))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const fromIntel = (intelligence?.competitors || [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.school || ''))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const raw =
    player.competingSchools ||
    player.rivals ||
    player.schoolsInvolved ||
    player.interestSchools ||
    [];
  const fromPlayer = Array.isArray(raw)
    ? raw
        .map((s) => (typeof s === 'string' ? s : s?.name || s?.school || ''))
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    : typeof raw === 'string' && raw.trim()
      ? [raw.trim()]
      : [];
  return [...new Set([...fromResearch, ...fromIntel, ...fromPlayer])].slice(0, 10);
}

/** Normalize live-beat getBeatPosts() which returns { posts } (not an array). */
function postsFromBeatCache(limit = 120) {
  try {
    const liveBeat = require('./live-beat');
    const result = liveBeat.getBeatPosts(limit);
    if (Array.isArray(result)) return result;
    return Array.isArray(result?.posts) ? result.posts : [];
  } catch {
    return [];
  }
}

function liveBeatRowsForPlayer(slug, playerName, limit = 8) {
  const slugKey = normalizeSlug(slug);
  const nameKey = String(playerName || '')
    .toLowerCase()
    .trim();
  const nameBits = nameKey
    ? nameKey.split(/\s+/).filter((p) => p.length >= 3)
    : [];
  const posts = postsFromBeatCache(120);
  const rows = [];
  for (const p of posts) {
    const text = String(p.text || '').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    let matched = false;
    if (nameKey && lower.includes(nameKey)) matched = true;
    if (!matched && nameBits.length >= 2) {
      matched = nameBits.every((bit) => lower.includes(bit));
    }
    if (!matched && slugKey) {
      try {
        const gate = require('./beat-recruiting-ingest-gate');
        const hit = gate.resolvePlayerFromTextSync(text);
        if (hit && normalizeSlug(hit.playerSlug) === slugKey) matched = true;
      } catch {
        /* optional */
      }
    }
    if (!matched) continue;
    rows.push({
      playerSlug: slugKey,
      playerName: playerName || null,
      source: `beat-writer:${p.handle || p.writerName || 'live'}`,
      detail: text,
      reportedAt: p.publishedAt || p.fetchedAt || null,
      articleUrl: p.url || p.link || null,
      ufRelevant: true,
      liveBeat: true,
      writerName: p.writerName || p.handle || null,
      outlet: p.outlet || null
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

function mergeBeatRows(intelRows = [], liveRows = []) {
  const seen = new Set();
  const out = [];
  const push = (row) => {
    const text = String(row.detail || row.skinny || row.text || '')
      .trim()
      .toLowerCase()
      .slice(0, 160);
    const key = `${row.reportedAt || ''}|${text}`;
    if (!text || seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };
  [...liveRows, ...intelRows]
    .sort(
      (a, b) =>
        new Date(b.reportedAt || b.createdAt || 0) - new Date(a.reportedAt || a.createdAt || 0)
    )
    .forEach(push);
  return out;
}

function offerSummary(intelligence, player = null) {
  const offers = intelligence?.offers;
  if (offers) {
    if (Array.isArray(offers)) {
      const joined = offers
        .slice(0, 8)
        .map((o) => (typeof o === 'string' ? o : o?.school || o?.name || ''))
        .filter(Boolean)
        .join(', ');
      if (joined) return joined;
    }
    if (Array.isArray(offers.items)) {
      const joined = offers.items
        .slice(0, 8)
        .map((o) => o.school || o.name || '')
        .filter(Boolean)
        .join(', ');
      if (joined) return joined;
    }
    if (offers.ufOffer === true) return 'UF offer on file';
    if (offers.count != null) return `${offers.count} offers tracked`;
  }

  const teams = player?.on3TopTeams || player?.topTeams || [];
  if (teams.length) {
    try {
      const on3 = require('./on3-recruit-client');
      const year = Number(player?.classYear) || 2028;
      const offered = on3
        .getYearTopTeams(teams, year)
        .filter((t) => !on3.isHighSchoolOrg(t) && /offer/i.test(String(t.status || '')))
        .map((t) => t.team?.name || t.name || t.school)
        .filter(Boolean);
      if (offered.length) return offered.slice(0, 10).join(', ');
    } catch {
      /* optional */
    }
  }
  return null;
}

function visitSummary(intelligence, player) {
  const parts = [];
  const vs = player?.ufOvStatus || player?.visitStatus || player?.officialVisitStatus;
  if (vs) parts.push(String(vs));
  const visits = intelligence?.visits;
  const items = Array.isArray(visits) ? visits : visits?.items || [];
  for (const v of items.slice(0, 6)) {
    const school = v.school || v.name || 'UF';
    const when = v.date || v.reportedAt || v.window || '';
    const kind = v.type || v.visitType || 'visit';
    parts.push([kind, school, when].filter(Boolean).join(' · '));
  }
  const window = [player?.visitStart, player?.visitEnd].filter(Boolean).join(' → ');
  if (window) parts.push(`window ${window}`);

  // Live On3 visit trail when intel DB is thin
  const trail = player?.visitTrail;
  if (Array.isArray(trail) && trail.length) {
    for (const row of trail.slice(0, 8)) {
      if (row?.label) parts.push(row.label);
    }
  } else if (player?.on3TopTeams || player?.topTeams) {
    try {
      const hydrate = require('./on3-board-hydrate');
      for (const row of hydrate.visitTrailFromTopTeams(
        player.on3TopTeams || player.topTeams,
        player.classYear || 2028,
        8
      )) {
        parts.push(row.label);
      }
    } catch {
      /* optional */
    }
  }

  return parts.length ? [...new Set(parts)].join('; ') : null;
}

function measurementsSummary(player) {
  try {
    return require('./on3-board-hydrate').measurementsLine(player || {});
  } catch {
    const ht = player?.htWt || [player?.height, player?.weight].filter(Boolean).join(' / ');
    return ht || null;
  }
}

function ufStaffSummary(player) {
  if (player?.ufStaff?.label) return player.ufStaff.label;
  if (Array.isArray(player?.ufStaff?.coaches) && player.ufStaff.coaches.length) {
    return `Florida staff: ${player.ufStaff.coaches.join(', ')}`;
  }
  try {
    const staff = require('./on3-board-hydrate').ufStaffFromTopTeams(
      player?.on3TopTeams || player?.topTeams || [],
      player?.classYear || 2028
    );
    return staff?.label || null;
  } catch {
    return null;
  }
}

function schoolLadderSummary(player, limit = 8) {
  const ladder = player?.schoolLadder;
  if (Array.isArray(ladder) && ladder.length) {
    return ladder
      .slice(0, limit)
      .map((s) => s.detail || s.label)
      .join('; ');
  }
  try {
    const hydrate = require('./on3-board-hydrate');
    return hydrate
      .schoolLadderDetailed(player?.on3TopTeams || player?.topTeams || [], player?.classYear || 2028, limit)
      .map((s) => s.detail)
      .join('; ');
  } catch {
    return interestedSchoolsSummary(player, []);
  }
}

function researchArchiveSummary(research) {
  const bits = [];
  for (const m of research?.hayesMentions || []) {
    bits.push(`Hayes: ${String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`);
  }
  for (const m of research?.beatMentions || []) {
    bits.push(`${m.label || 'Beat'}: ${String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`);
  }
  for (const h of research?.heatSignals || []) {
    bits.push(
      `Heat: ${[h.trigger, h.direction, h.predictionSchool, h.insider].filter(Boolean).join(' · ')}`
    );
  }
  return bits.length ? bits.slice(0, 8) : [];
}

function rpmSummary(intelligence, research, player) {
  const rpm = intelligence?.rpm || {};
  const preds = research?.predictions || [];
  const bits = [];
  let ufPct = rpm.ufPct ?? rpm.floridaPct ?? player?.ufRpmPct ?? player?.ufProbability ?? player?.ufConfidence;
  let leader = rpm.leader || rpm.leaderSchool || null;

  if ((ufPct == null || !leader) && (player?.on3TopTeams || player?.topTeams || research?.on3TopTeams)) {
    try {
      const hydrate = require('./on3-board-hydrate');
      const teams = player?.on3TopTeams || player?.topTeams || research?.on3TopTeams || [];
      const year = player?.classYear || research?.player?.classYear || 2028;
      if (ufPct == null) ufPct = hydrate.ufRpmFromTopTeams(teams, year);
      if (!leader) {
        const schools = hydrate.interestedSchoolsFromTopTeams(teams, year, 1);
        if (schools[0]) leader = schools[0].school;
      }
    } catch {
      /* optional */
    }
  }

  if (ufPct != null) bits.push(`UF ${pct(ufPct)}`);
  if (leader) bits.push(`leader ${leader}`);
  for (const p of preds.slice(0, 3)) {
    const conf = p.confidencePct ?? p.ufRpmPct;
    bits.push(`${p.source || 'Analyst'}${conf != null ? ` ${pct(conf)}` : ''}${p.detail ? ` — ${String(p.detail).slice(0, 80)}` : ''}`);
  }
  return bits.length ? bits.join(' | ') : null;
}

function rankingSummary(player) {
  try {
    return require('./on3-board-hydrate').rankingLine(player || {});
  } catch {
    return null;
  }
}

function interestedSchoolsSummary(player, rivals = []) {
  try {
    const hydrate = require('./on3-board-hydrate');
    const schools = hydrate.interestedSchoolsFromTopTeams(
      player?.on3TopTeams || player?.topTeams || [],
      player?.classYear || 2028,
      8
    );
    if (schools.length) return schools.map((s) => s.label).join('; ');
  } catch {
    /* optional */
  }
  if (rivals?.length) return rivals.slice(0, 8).join(', ');
  return null;
}

function buildBoardFacts({ player, intelligence, research, rivals }) {
  const staffNotes =
    research?.breakdown?.staffNotes ||
    research?.breakdown?.insiderNotes ||
    research?.scouting?.scoutingSummary ||
    research?.breakdown?.recruitingStory ||
    null;
  const archive = researchArchiveSummary(research);
  return {
    measurements: measurementsSummary(player),
    rankings: rankingSummary(player),
    rating: player?.rating != null ? String(Number(player.rating).toFixed(2)) : null,
    nilValue: player?.nilValue != null ? String(player.nilValue) : null,
    hometown: player?.hometown || null,
    school: player?.school || player?.highSchool || null,
    interestedSchools: interestedSchoolsSummary(player, rivals),
    schoolLadder: schoolLadderSummary(player, 8),
    offers: offerSummary(intelligence, player),
    visits: visitSummary(intelligence, player),
    rpm: rpmSummary(intelligence, research, player),
    ufStaff: ufStaffSummary(player),
    staffNotes,
    archiveLines: archive,
    on3ProfileUrl: player?.on3ProfileUrl || null,
    profile247: research?.profile247?.url || null
  };
}

function buildWhyFlorida({ player, research, intelligence, beatRows, rivals }) {
  rivals = Array.isArray(rivals) ? rivals : [];
  beatRows = Array.isArray(beatRows) ? beatRows : [];
  const bits = [];
  const meas = measurementsSummary(player);
  const school = player?.school || player?.highSchool;
  const hometown = player?.hometown;
  if (meas || school || hometown) {
    bits.push(
      `Profile: ${[meas, player?.position || player?.pos, player?.classYear ? `Class ${player.classYear}` : null, school, hometown]
        .filter(Boolean)
        .join(' · ')}.`
    );
  }
  const ranks = rankingSummary(player);
  if (ranks) bits.push(`On3 board: ${ranks}${player?.rating != null ? ` (rating ${Number(player.rating).toFixed(2)})` : ''}.`);

  const interested = interestedSchoolsSummary(player, rivals);
  const ladder = schoolLadderSummary(player, 5);
  const ufRpm = pct(player?.ufRpmPct ?? player?.ufProbability ?? player?.ufConfidence ?? player?.floridaOdds);
  if (ufRpm) {
    bits.push(`Florida On3 RPM ~${ufRpm}${interested && /florida/i.test(interested) ? ' (leads involved schools)' : ''}.`);
  }
  const staff = ufStaffSummary(player);
  if (staff) bits.push(`${staff}.`);

  const ufPos = research?.ufPosition;
  const eventType = research?.eventType;
  if (ufPos) bits.push(`UF board read: ${ufPos}.`);
  if (eventType && eventType !== 'update') bits.push(`Latest signal type: ${eventType.replace(/_/g, ' ')}.`);

  const ufStatus = player?.ufStatus || player?.status;
  if (ufStatus) bits.push(`Tracked UF status: ${ufStatus}.`);

  const visits = visitSummary(intelligence, player);
  if (visits) bits.push(`Visit / OV trail: ${visits}.`);

  const offers = offerSummary(intelligence, player);
  if (offers) bits.push(`Offer picture: ${offers}.`);

  if (ladder) bits.push(`School ladder (RPM / visits / coaches): ${ladder}.`);
  else if (interested) bits.push(`Interested / involved schools: ${interested}.`);
  else if (rivals.length) bits.push(`Competition set: ${rivals.slice(0, 6).join(', ')}.`);

  const archive = researchArchiveSummary(research);
  for (const line of archive.slice(0, 3)) bits.push(line);

  const staffNotes =
    research?.breakdown?.staffNotes ||
    research?.breakdown?.insiderNotes ||
    research?.scouting?.scoutingSummary ||
    research?.breakdown?.recruitingStory;
  if (staffNotes) bits.push(`Staff / insider note: ${String(staffNotes).replace(/\s+/g, ' ').trim().slice(0, 220)}`);

  const freshBeat = beatRows.find((r) => daysAgo(r.reportedAt || r.createdAt) != null && daysAgo(r.reportedAt || r.createdAt) <= 2);
  if (freshBeat) {
    bits.push(
      `Fresh beat (${freshBeat.source || 'writer'}): ${String(freshBeat.detail || freshBeat.skinny || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180)}`
    );
  }

  if (!bits.length) {
    return 'Florida is tracking this prospect; vault file is thin on a hard why-UF hook — lean on the freshest beat line and board facts only.';
  }
  return bits.join(' ');
}

function buildVaultAngle({ playerName, research, intelligence, beatRows, rivals, whyFlorida, player }) {
  rivals = Array.isArray(rivals) ? rivals : [];
  beatRows = Array.isArray(beatRows) ? beatRows : [];
  const name = playerName || 'This prospect';
  const eventType = (research?.eventType || 'update').replace(/_/g, ' ');
  const ufPos = research?.ufPosition || 'tracking';
  const ranks = rankingSummary(player);
  const interested = interestedSchoolsSummary(player, rivals);
  const concrete =
    ranks ||
    (interested ? String(interested).split(';')[0].trim() : null) ||
    rivals.filter((r) => { try { return !require('./on3-board-hydrate').isUfSchoolName(r); } catch { return !/^(florida|gators|uf)$/i.test(String(r||'').trim()); } })[0] ||
    null;
  const fresh = beatRows[0]
    ? String(beatRows[0].detail || beatRows[0].skinny || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140)
    : null;
  const rivalHook = rivals.filter((r) => { try { return !require('./on3-board-hydrate').isUfSchoolName(r); } catch { return !/^(florida|gators|uf)$/i.test(String(r||'').trim()); } }).slice(0, 2);
  const gaps = intelligence?.gaps || research?.gaps || [];

  const lines = [];
  if (concrete) {
    lines.push(
      `Angle: Don't recap the ${eventType} headline on ${name}. Lead with Florida's stake (${ufPos}) and the board fact beat writers bury: ${concrete}.`
    );
  } else {
    lines.push(
      `Angle: Take today's ${eventType} beat on ${name} and frame UF as ${ufPos} — not a recap. Lead with the Florida stake, then one concrete board fact.`
    );
  }
  if (fresh) lines.push(`Beat hook to advance: "${fresh}"`);
  if (rivalHook.length) {
    lines.push(
      `Pressure angle vs ${rivalHook.join(' / ')}: use On3 interest/RPM + visit/staff access UF still controls — not the same school-list dump the beat used.`
    );
  }
  const meas = measurementsSummary(player);
  const staff = ufStaffSummary(player);
  const visits = visitSummary(intelligence, player);
  const ladder = schoolLadderSummary(player, 5);
  if (ranks || ladder || staff || visits) {
    const parts = [];
    if (meas) parts.push(`size ${meas}`);
    if (ranks) parts.push(`ranks ${ranks}`);
    if (staff) parts.push(staff);
    if (visits) parts.push(`visits ${String(visits).slice(0, 140)}`);
    if (ladder) parts.push(`ladder ${String(ladder).split(';').slice(0, 4).join('; ')}`);
    lines.push(
      `Vault edge (verified long-form): stack ${parts.join(' | ')} — then the UF why. Elite verified post, not a beat echo.`
    );
  } else if (gaps.length) {
    lines.push(`Vault edge (fill what beat skipped): ${gaps.slice(0, 4).join(', ')}.`);
  } else {
    lines.push(
      'Vault edge: stack offers/visits/RPM + staff note under the beat so readers get the UF why, not just the headline.'
    );
  }
  lines.push(`Why UF (use in copy, don't invent beyond this): ${whyFlorida}`);
  return lines.join('\n');
}

function formatBriefText({
  slug,
  playerName,
  player,
  inspect,
  beatRows,
  research,
  intelligence,
  whyFlorida,
  vaultAngle,
  rivals
}) {
  rivals = Array.isArray(rivals) ? rivals : [];
  beatRows = Array.isArray(beatRows) ? beatRows : [];
  const lines = [];
  lines.push('GATORVAULT BEAT BRIEF');
  lines.push('=====================');
  lines.push(line('Player', playerName || slug) || `Player: ${slug}`);
  lines.push(line('Slug', slug));
  lines.push(line('Class', player?.classYear || player?.year));
  lines.push(line('Position', player?.position || player?.pos));
  lines.push(line('Stars', player?.stars));
  lines.push(line('School', player?.school || player?.highSchool || player?.fromSchool));
  lines.push(line('Hometown / State', player?.hometown || player?.state || player?.hometownState));
  lines.push(line('National rank', player?.natlRank || player?.nationalRank));
  lines.push(line('Position rank', player?.posRank || player?.positionRank));
  lines.push(line('State rank', player?.stateRank));
  lines.push(line('On3 ranks', rankingSummary(player)));
  lines.push(line('Size / measurables', measurementsSummary(player)));
  lines.push(line('Composite / rating', player?.composite || player?.rating || player?.compositeScore));
  lines.push(line('NIL value (On3)', player?.nilValue));
  lines.push(line('UF likelihood', pct(player?.ufRpmPct ?? player?.ufProbability ?? player?.ufConfidence ?? player?.floridaOdds)));
  lines.push(line('UF status', player?.ufStatus || player?.status));
  lines.push(line('UF staff', ufStaffSummary(player)));
  lines.push(line('UF board read', research?.ufPosition));
  lines.push(line('Signal type', research?.eventType));
  lines.push(line('Committed to', player?.committedTo));
  lines.push(line('Interested schools', interestedSchoolsSummary(player, rivals)));
  lines.push(line('School ladder', schoolLadderSummary(player, 8)));
  if (rivals.length) lines.push(line('Rivals / involved', rivals.join(', ')));
  lines.push(line('Visit / OV trail', visitSummary(intelligence, player)));
  lines.push(line('Offers', offerSummary(intelligence, player)));
  lines.push(line('RPM / predictions', rpmSummary(intelligence, research, player)));
  lines.push(line('On3 profile', player?.on3ProfileUrl));
  if (research?.profile247?.url) lines.push(line('247 profile', research.profile247.url));

  lines.push('');
  lines.push('WHY FLORIDA');
  lines.push('-----------');
  lines.push(whyFlorida || '(thin)');

  lines.push('');
  lines.push('VAULT ANGLE (ahead of the beat)');
  lines.push('-------------------------------');
  lines.push(vaultAngle || '(thin)');

  const staff =
    research?.breakdown?.staffNotes ||
    research?.breakdown?.insiderNotes ||
    research?.scouting?.scoutingSummary ||
    research?.breakdown?.recruitingStory;
  if (staff) {
    lines.push('');
    lines.push('STAFF / SCOUTING');
    lines.push('----------------');
    lines.push(String(staff).replace(/\s+/g, ' ').trim().slice(0, 500));
  }

  lines.push('');
  lines.push('BEAT INTEL (newest first — live stream + intel DB)');
  lines.push('--------------------------------------------------');
  if (!beatRows.length) {
    lines.push('(No beat intel rows on file for this player.)');
  } else {
    beatRows.slice(0, 10).forEach((row, i) => {
      const when = row.reportedAt || row.createdAt || '';
      const src = row.source || 'beat';
      const live = row.liveBeat ? ' LIVE' : '';
      const text = String(row.detail || row.skinny || row.text || '').trim();
      lines.push(`${i + 1}. [${when}] (${src}${live})`);
      lines.push(text || '(empty)');
      if (row.articleUrl || row.url) lines.push(`Source: ${row.articleUrl || row.url}`);
      lines.push('');
    });
  }

  const sources = research?.sourcesUsed || [];
  if (sources.length) {
    lines.push('RESEARCH SOURCES');
    lines.push('----------------');
    sources.slice(0, 12).forEach((s, i) => {
      lines.push(`${i + 1}. ${s.label}${s.snippet ? ` — ${s.snippet}` : ''}`);
    });
    lines.push('');
  }

  const draftText =
    inspect?.fullCompose?.ok && inspect.fullCompose.text
      ? inspect.fullCompose.text
      : inspect?.drafts?.[0]?.textPreview || null;
  if (draftText) {
    lines.push('DRAFT SUGGESTION (optional)');
    lines.push('---------------------------');
    lines.push(String(draftText).trim());
    lines.push('');
  }

  const archive = researchArchiveSummary(research);
  if (archive.length) {
    lines.push('');
    lines.push('BEAT / INSIDER ARCHIVE');
    lines.push('----------------------');
    archive.forEach((row, i) => lines.push(`${i + 1}. ${row}`));
  }

  lines.push('');
  lines.push('ELITE DEPTH CHECKLIST (use what is on file — do not invent)');
  lines.push('-------------------------------------------------------------');
  lines.push('- Identity: name, class, position, high school, hometown, size');
  lines.push('- On3 ranks: national + position + state + stars/rating');
  lines.push('- Florida stake: RPM %, offer/status, UF staff names if listed');
  lines.push('- School ladder: top interested schools with RPM + visit counts');
  lines.push('- Visit trail: OV/UOV + latest dates when present');
  lines.push('- Beat/insider archive: advance the freshest line, do not rewrite it');
  lines.push('- Vault angle: Florida-first narrative ahead of the beat recap');

  lines.push('');
  lines.push('INSTRUCTIONS FOR AI');
  lines.push('-------------------');
  lines.push(
    'Write one GatorVault Insider X post for a VERIFIED account (long-form OK). Target 600–900 characters (hard cap 1000). Use WHY FLORIDA + VAULT ANGLE + ELITE DEPTH CHECKLIST. Structure: (1) Florida stake opener, (2) On3 ranks/size/school identity, (3) RPM ladder + 1–2 rival pressure points, (4) visit/staff fact if on file, (5) ahead-of-the-beat closer. Stay factual to board + beat above only — no invented offers, visits, rankings, or quotes. UF voice, no banned claims. Prefer one dense post over a thread unless asked.'
  );

  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Full brief packet for Beat Desk UI + copy/paste.
 * Research always runs. Heavy inspect/compose only when opts.full === true.
 */
async function buildBeatBrief(slug, opts = {}) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return { ok: false, error: 'missing_slug' };

  const { inspectPlayer, isBeatIntel } = require('./post-studio-intel-inbox');

  await intelStore.initIntelStore().catch(() => {});

  const wantFull = opts && opts.full === true;
  let [inspect, player] = await Promise.all([
    wantFull
      ? inspectPlayer(normalized).catch((err) => ({ ok: false, error: err.message }))
      : Promise.resolve({ ok: true, playerName: null, verdict: null, fullCompose: null, drafts: [] }),
    loadRecruitingPlayer(normalized)
  ]);

  // Live On3 hydrate when store is thin — every Open needs ranks + interested schools.
  try {
    const hydrate = require('./on3-board-hydrate');
    if (hydrate.boardNeedsHydration(player)) {
      const seedName =
        inspect?.playerName ||
        player?.name ||
        player?.fullName ||
        hydrate.humanizeSlugName(normalized);
      const hydrated = await hydrate.hydrateRecruitBoard({
        slug: normalized,
        name: seedName,
        player,
        classYear: player?.classYear || player?.year || null,
        pos: player?.pos || player?.position || null
      });
      if (hydrated?.player) player = hydrated.player;
    }
  } catch {
    /* optional live On3 */
  }

  const allIntel = intelStore.getIntelForPlayer({ playerSlug: normalized }) || [];
  const intelBeatRows = allIntel
    .filter((r) => isBeatIntel(r) || r.ufRelevant === true)
    .sort(
      (a, b) =>
        new Date(b.reportedAt || b.createdAt || 0) - new Date(a.reportedAt || a.createdAt || 0)
    );

  let playerName =
    inspect?.playerName ||
    player?.name ||
    player?.fullName ||
    intelBeatRows[0]?.playerName ||
    normalized;

  const liveRows = liveBeatRowsForPlayer(normalized, playerName, 10);
  if (!playerName || playerName === normalized) {
    playerName = liveRows[0]?.playerName || playerName;
  }
  const beatRows = mergeBeatRows(intelBeatRows, liveRows);

  if (inspect && !inspect.playerName) inspect.playerName = playerName;

  const primaryBeat = beatRows[0] || null;
  let research = null;
  try {
    const { researchUpdate } = require('./x-autoposter-elite-research');
    research = await researchUpdate({
      playerSlug: normalized,
      playerName,
      beatText: primaryBeat ? String(primaryBeat.detail || primaryBeat.skinny || '') : null,
      sourceLabel: primaryBeat?.source || null,
      intel: primaryBeat,
      headline: `${playerName} Florida recruiting`
    });
  } catch (err) {
    research = { error: err.message, sourcesUsed: [], predictions: [], beatMentions: [] };
  }

  let intelligence = null;
  try {
    const { getPlayerIntelligence } = require('./player-intelligence');
    intelligence = await getPlayerIntelligence(normalized, { coverageTier: 'standard' });
  } catch {
    intelligence = null;
  }

  const rivals = rivalList(player || {}, research, intelligence);
  const whyFlorida = buildWhyFlorida({
    player: player || {},
    research,
    intelligence,
    beatRows,
    rivals
  });
  const vaultAngle = buildVaultAngle({
    playerName,
    research,
    intelligence,
    beatRows,
    rivals,
    whyFlorida,
    player: player || {}
  });

  const boardFacts = buildBoardFacts({
    player: player || {},
    intelligence,
    research,
    rivals
  });

  // Persist desk board intel into FutureCast targeting (new seed or % nudge).
  let futurecastFeed = null;
  if (opts.feedFutureCast !== false) {
    try {
      const { feedDeskIntelToFutureCast } = require('./desk-intel-futurecast-feed');
      futurecastFeed = await feedDeskIntelToFutureCast({
        slug: normalized,
        player: player || null,
        research: {
          eventType: research?.eventType,
          ufPosition: research?.ufPosition,
          playerName
        },
        signalType: research?.eventType || research?.ufPosition || null,
        dryRun: opts.dryRun === true
      });
      if (futurecastFeed?.player && player) {
        // Keep brief response aligned with what we just wrote.
        if (futurecastFeed.player.ufProbability != null) {
          player.ufProbability = futurecastFeed.player.ufProbability;
          player.futurecastProbability = futurecastFeed.player.ufProbability;
        }
        if (futurecastFeed.player.ufRpmPct != null) player.ufRpmPct = futurecastFeed.player.ufRpmPct;
      }
    } catch (err) {
      futurecastFeed = {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  const pasteText = formatBriefText({
    slug: normalized,
    playerName,
    player: player || {},
    inspect: inspect?.ok ? inspect : null,
    beatRows,
    research,
    intelligence,
    whyFlorida,
    vaultAngle,
    rivals
  });

  let pasteOut = pasteText;
  if (futurecastFeed?.ok) {
    const mode = futurecastFeed.isNew
      ? 'brand-new → seed'
      : futurecastFeed.promoted
        ? 'promoted onto board'
        : 'existing target → refresh';
    const d = futurecastFeed.decision || null;
    let pctLine = null;
    if (d) {
      const pctLabel = d.pct != null ? d.pct + '%' : 'n/a';
      let deltaLabel = '';
      if (d.delta) deltaLabel = ', Δ' + (d.delta > 0 ? '+' : '') + d.delta;
      pctLine = 'UF targeting %: ' + pctLabel + ' (' + d.source + deltaLabel + ')';
    }
    const fcLines = [
      '',
      'FUTURECAST FEED',
      '---------------',
      'Mode: ' + mode,
      pctLine,
      futurecastFeed.allowlisted != null
        ? 'Allowlist: ' + (futurecastFeed.allowlisted ? 'yes' : 'no')
        : null,
      'Board fields synced: ranks, size, schools, visits, RPM, staff (when on file).'
    ].filter(Boolean);
    pasteOut = pasteText + '\n' + fcLines.join('\n') + '\n';
  } else if (futurecastFeed && futurecastFeed.ok === false) {
    pasteOut =
      pasteText +
      '\n\nFUTURECAST FEED\n---------------\n(deferred: ' +
      (futurecastFeed.error || 'unavailable') +
      ')\n';
  }

  const liveMentions = [
    ...(research?.hayesMentions || []),
    ...(research?.beatMentions || [])
  ].slice(0, 8);

  return {
    ok: true,
    slug: normalized,
    playerName,
    updatedAt: new Date().toISOString(),
    player: player
      ? {
          classYear: player.classYear || player.year || null,
          position: player.position || player.pos || null,
          stars: player.stars ?? null,
          school: player.school || player.highSchool || null,
          state: player.state || player.hometownState || null,
          hometown: player.hometown || null,
          height: player.height || null,
          weight: player.weight ?? null,
          htWt: player.htWt || measurementsSummary(player),
          ufProbability: player.ufProbability ?? player.ufConfidence ?? null,
          ufRpmPct: player.ufRpmPct ?? null,
          ufStatus: player.ufStatus || player.status || null,
          ufStaff: ufStaffSummary(player),
          committedTo: player.committedTo || null,
          rivals,
          natlRank: player.natlRank || player.nationalRank || null,
          posRank: player.posRank || player.positionRank || null,
          stateRank: player.stateRank || null,
          rating: player.rating || player.composite || null,
          nilValue: player.nilValue ?? null,
          on3Slug: player.on3Slug || null,
          on3ProfileUrl: player.on3ProfileUrl || null,
          rankings: rankingSummary(player),
          interestedSchools: interestedSchoolsSummary(player, rivals),
          schoolLadder: schoolLadderSummary(player, 8),
          visitTrail: visitSummary(null, player),
          visitStatus: player.ufOvStatus || player.visitStatus || null
        }
      : { rivals },
    beatCount: beatRows.length,
    liveBeatCount: liveRows.length,
    primaryBeat: primaryBeat
      ? {
          text: String(primaryBeat.detail || primaryBeat.skinny || '').trim(),
          source: primaryBeat.source || null,
          reportedAt: primaryBeat.reportedAt || primaryBeat.createdAt || null,
          articleUrl: primaryBeat.articleUrl || primaryBeat.url || null,
          liveBeat: !!primaryBeat.liveBeat
        }
      : null,
    research: {
      ufPosition: research?.ufPosition || null,
      eventType: research?.eventType || null,
      hasUsableSignal: !!research?.hasUsableSignal,
      topSchools: rivals,
      measurements: boardFacts.measurements,
      rankings: boardFacts.rankings,
      interestedSchools: boardFacts.interestedSchools,
      schoolLadder: boardFacts.schoolLadder,
      offers: boardFacts.offers,
      visits: boardFacts.visits,
      rpm: boardFacts.rpm,
      ufStaff: boardFacts.ufStaff,
      staffNotes: boardFacts.staffNotes,
      archiveLines: boardFacts.archiveLines,
      on3ProfileUrl: boardFacts.on3ProfileUrl,
      scoutingSummary: research?.scouting?.scoutingSummary || null,
      boardFacts,
      whyFlorida,
      vaultAngle,
      postGuidance: {
        verifiedLongForm: true,
        targetCharsMin: 600,
        targetCharsMax: 900,
        hardCap: 1000,
        structure: [
          'Florida stake opener',
          'On3 ranks / size / school identity',
          'RPM ladder + rival pressure',
          'Visit or staff fact if on file',
          'Ahead-of-the-beat closer'
        ]
      },
      liveMentions: liveMentions.map((m) => ({
        label: m.label,
        text: m.text,
        url: m.url || null,
        at: m.at || null
      })),
      sourcesUsed: (research?.sourcesUsed || []).slice(0, 12),
      timing: research?.timing || null
    },
    futurecastFeed,
    draftSuggestion:
      inspect?.fullCompose?.ok && inspect.fullCompose.text
        ? {
            text: inspect.fullCompose.text,
            thin: !!inspect.fullCompose.thin,
            path: inspect.fullCompose.composePath || null
          }
        : null,
    verdict: inspect?.verdict || null,
    pasteText: typeof pasteOut !== 'undefined' ? pasteOut : pasteText
  };
}

module.exports = {
  buildBeatBrief,
  formatBriefText,
  buildWhyFlorida,
  buildVaultAngle,
  buildBoardFacts,
  rankingSummary,
  interestedSchoolsSummary,
  schoolLadderSummary,
  visitSummary,
  ufStaffSummary,
  measurementsSummary,
  liveBeatRowsForPlayer,
  mergeBeatRows,
  postsFromBeatCache
};
