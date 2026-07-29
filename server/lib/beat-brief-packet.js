/**
 * Beat Brief Desk — paste-ready player/UF research packet for Charles → Cursor/Copilot → X.
 * Fuses beat writers + recruiting store + elite research so every Open yields a full UF angle.
 */
const intelStore = require('./recruiting-intel-store');

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function isCommittedPlayer(player, research) {
  if (!player && !research) return false;
  if (research?.eventType === 'commit' || research?.eventType === 'flip') return true;
  if (/committed/i.test(String(research?.ufPosition || ''))) return true;
  const status = String(player?.ufStatus || player?.status || '');
  if (/committed|signed|enrolled/i.test(status)) return true;
  if (player?.committedTo && /florida|gators/i.test(String(player.committedTo))) return true;
  const teams = player?.on3TopTeams || player?.topTeams || [];
  try {
    const on3 = require('./on3-recruit-client');
    const year = Number(player?.classYear) || 2028;
    const uf = on3.getFloridaTeam(teams, year);
    if (uf && /commit|signed|enrolled/i.test(String(uf.status || ''))) return true;
  } catch {
    /* optional */
  }
  return false;
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
  let hub = null;
  try {
    hub = require('./hub-desk-topics').parseHubDeskSlug(slugKey);
  } catch {
    hub = null;
  }
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
    try {
      const pre = require('./beat-intel-prefilter');
      if (pre.isSubscribePromoIntel?.(text)) continue;
    } catch {
      /* optional */
    }
    const lower = text.toLowerCase();
    let matched = false;
    if (hub) {
      try {
        const pre = require('./beat-intel-prefilter');
        const typed =
          hub.kind === 'program'
            ? pre.classifyProgramNewsType?.(text)
            : pre.classifyTeamEventType?.(text);
        matched = typed === hub.type || (hub.type === 'general' && !!typed);
        if (!matched) {
          const hubRow = require('./hub-desk-topics').classifyHubDeskBeat(text, p);
          matched = !!(hubRow && normalizeSlug(hubRow.playerSlug) === slugKey);
        }
      } catch {
        matched = false;
      }
    } else {
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
      const yearTeams = on3.getYearTopTeams(teams, year).filter((t) => !on3.isHighSchoolOrg(t));
      const offered = yearTeams
        .filter((t) => /offer|commit|signed|enrolled/i.test(String(t.status || '')))
        .map((t) => {
          const school = t.team?.name || t.name || t.school;
          const status = String(t.status || '');
          if (/commit|signed|enrolled/i.test(status) && school) return `${school} (Committed)`;
          return school;
        })
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
  const committed = isCommittedPlayer(player, research);
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
    bits.push(
      committed
        ? `Florida On3 RPM ~${ufRpm} (commit locked).`
        : `Florida On3 RPM ~${ufRpm}${interested && /florida/i.test(interested) ? ' (leads involved schools)' : ''}.`
    );
  }
  const staff = ufStaffSummary(player);
  if (staff) bits.push(`${staff}.`);

  const ufPos = committed ? 'committed' : research?.ufPosition;
  const eventType = committed && (!research?.eventType || research.eventType === 'target_update' || research.eventType === 'update' || research.eventType === 'trending')
    ? 'commit_culture'
    : research?.eventType;
  if (ufPos) bits.push(`UF board read: ${ufPos}.`);
  if (eventType && eventType !== 'update') bits.push(`Latest signal type: ${eventType.replace(/_/g, ' ')}.`);

  const ufStatus = player?.ufStatus || player?.status;
  if (ufStatus) bits.push(`Tracked UF status: ${ufStatus}.`);
  if (committed && player?.committedTo) bits.push(`Committed to: ${player.committedTo}.`);

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
    return 'Florida is tracking this prospect; vault file is thin on a hard why-UF hook — lean on verified board facts only.';
  }
  return bits.join(' ');
}

function buildVaultAngle({
  playerName,
  research,
  intelligence,
  beatRows,
  rivals,
  whyFlorida,
  player,
  filmTraits = null,
}) {
  rivals = Array.isArray(rivals) ? rivals : [];
  beatRows = Array.isArray(beatRows) ? beatRows : [];
  const name = playerName || 'This prospect';
  const eventType = (research?.eventType || 'update').replace(/_/g, ' ');
  const ufPos = research?.ufPosition || 'tracking';
  const ranks = rankingSummary(player);
  const interested = interestedSchoolsSummary(player, rivals);
  const filmHook =
    filmTraits?.vaultFilmAngle ||
    (Array.isArray(filmTraits?.traits) && filmTraits.traits[0]) ||
    null;
  const concrete =
    filmHook ||
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

  const committed = isCommittedPlayer(player, research);
  const stake = committed ? 'committed' : ufPos;
  const signal = committed && (eventType === 'update' || eventType === 'target update' || eventType === 'trending')
    ? 'commit culture'
    : eventType;
  const lines = [];
  if (committed) {
    lines.push(
      `Angle: ${name} is a Florida COMMIT — do not frame as an open board chase. Own the culture/ownership story in Vault voice (program member energy, fall plans, class leadership) without citing writers. Lead with commit stake + one board credential (${concrete || 'ranks/size/staff'}).`
    );
  } else if (filmHook) {
    lines.push(
      `Angle: Own ${name} in Vault voice. Lead with Florida's stake (${stake}) and the film on file: ${String(filmHook).slice(0, 220)}`
    );
  } else if (concrete) {
    lines.push(
      `Angle: Own ${name} in Vault voice. Lead with Florida's stake (${stake}) and this board fact: ${concrete}.`
    );
  } else {
    lines.push(
      `Angle: Own today's ${signal} story on ${name} and frame UF as ${stake} — original Vault take, not a recap. Lead with the Florida stake, then one concrete board fact.`
    );
  }
  if (fresh) {
    lines.push(
      `INTERNAL intel seed (absorb into Vault voice — NEVER name writers, never say beat/report/according to): "${fresh}"`
    );
  }
  if (committed) {
    lines.push(
      'Pressure angle: none — commitment is locked. If rivals appear on the ladder they are former board noise; use them only as contrast to how locked UF already is.'
    );
  } else if (rivalHook.length) {
    lines.push(
      `Rival context (optional, mid-post only — never the closer/punchline): ${rivalHook.join(' / ')} may appear as calm board fact (RPM/interest). Do not dunk on them, do not frame the post as beating their inevitability. Close on Florida process (visits/staff/film).`
    );
  }
  const meas = measurementsSummary(player);
  const staff = ufStaffSummary(player);
  const visits = visitSummary(intelligence, player);
  const ladder = schoolLadderSummary(player, 5);
  if (filmTraits?.traits?.length || ranks || ladder || staff || visits) {
    const parts = [];
    if (filmTraits?.traits?.length) {
      parts.push(`film ${filmTraits.traits.slice(0, 2).join('; ')}`);
    }
    if (meas) parts.push(`size ${meas}`);
    if (ranks) parts.push(`ranks ${ranks}`);
    if (staff) parts.push(staff);
    if (visits) parts.push(`visits ${String(visits).slice(0, 140)}`);
    if (ladder) parts.push(`ladder ${String(ladder).split(';').slice(0, 4).join('; ')}`);
    lines.push(
      committed
        ? `Vault edge (verified long-form COMMIT): stack ${parts.join(' | ')} under the ownership/culture hook — elite Vault voice — ownership story, not a chase recap.`
        : `Vault edge (verified long-form): stack ${parts.join(' | ')} — then the UF why. State board + film as Vault fact; never announce that you’re different or ahead of anyone.`
    );
  } else if (gaps.length) {
    lines.push(`Vault edge (fill the board gaps): ${gaps.slice(0, 4).join(', ')}.`);
  } else {
    lines.push(
      'Vault edge: stack offers/visits/RPM + staff note under the hook so readers get the UF why, not just the headline.'
    );
  }
  lines.push(`Why UF (use in copy, don't invent beyond this): ${whyFlorida}`);
  return lines.join('\n');
}

/** Format curated Hudl/On3 film traits for paste-ready Copy Brief. */
function formatFilmTraitsBlock(filmTraits) {
  if (!filmTraits || typeof filmTraits !== 'object') return null;
  const sources = Array.isArray(filmTraits.sources) ? filmTraits.sources.filter((s) => s && s.url) : [];
  const traits = Array.isArray(filmTraits.traits) ? filmTraits.traits.filter(Boolean) : [];
  if (!sources.length && !traits.length && !filmTraits.clipNotes) return null;

  const lines = [];
  if (traits.length) {
    lines.push('FILM / HIGHLIGHTS (Vault traits — weave into the post as fact)');
    lines.push('-----------------------------------------------------------');
  } else {
    lines.push('FILM / HIGHLIGHTS (tape linked from On3/Hudl — Vault traits pending review)');
    lines.push('--------------------------------------------------------------------------');
  }
  if (filmTraits.playerName) lines.push(`Player: ${filmTraits.playerName}`);
  if (filmTraits.on3ProfileUrl) lines.push(`On3 profile: ${filmTraits.on3ProfileUrl}`);
  if (sources.length) {
    sources.slice(0, 4).forEach((s, i) => {
      const label = s.label || s.type || 'source';
      const url = s.url || '';
      const when = s.reviewedAt ? ` (reviewed ${s.reviewedAt})` : s.ingestedAt ? ` (linked ${s.ingestedAt})` : '';
      lines.push(`Source ${i + 1}: ${label}${when}${url ? ` — ${url}` : ''}`);
    });
  } else {
    lines.push('Source: (no URL on file — traits only)');
  }
  if (traits.length) {
    lines.push('Traits from tape:');
    traits.slice(0, 8).forEach((t) => lines.push(`- ${t}`));
  } else if (sources.length) {
    lines.push('Traits: (pending Vault review — open the tape, evaluate like a scout, upsert traits)');
  }
  if (filmTraits.vaultFilmAngle) {
    lines.push(`Vault film angle: ${String(filmTraits.vaultFilmAngle).trim()}`);
  }
  if (filmTraits.clipNotes) {
    lines.push(`Clip notes: ${String(filmTraits.clipNotes).trim()}`);
  }
  const dont = Array.isArray(filmTraits.doNotClaim) ? filmTraits.doNotClaim.filter(Boolean) : [];
  if (dont.length) {
    lines.push('Do not claim from this reel:');
    dont.slice(0, 6).forEach((t) => lines.push(`- ${t}`));
  }
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
  rivals,
  filmTraits = null,
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
  lines.push('VAULT ANGLE (own the story — Vault voice)');
  lines.push('-------------------------------');
  lines.push(vaultAngle || '(thin)');

  const filmBlock = formatFilmTraitsBlock(filmTraits);
  if (filmBlock) {
    lines.push('');
    lines.push(filmBlock);
  } else {
    lines.push('');
    lines.push('FILM / HIGHLIGHTS');
    lines.push('-----------------');
    lines.push(
      '(No On3/Hudl tape linked yet. Open this player again after hydrate, or POST /api/admin/hub/film-traits/hydrate.)'
    );
  }

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
  lines.push('- Film / highlights: if FILM section has traits, put 1–2 tape facts in the post as plain Vault observation');
  lines.push('- Internal intel seed: steal the FACT, own the VOICE — never tip that a beat writer said it');
  lines.push('- Vault angle: Florida-first narrative that sounds like GatorVault, not a recap desk');
  lines.push('- Show, don\'t announce: never claim to be different, ahead of the beat, or what "most feeds / timelines" miss');
  lines.push('- Rivals: context only (one calm board fact mid-post if needed). Never dunk, never make the rival the punchline or closer');

  lines.push('');
  lines.push('INSTRUCTIONS FOR AI');
  lines.push('-------------------');
  lines.push(
    'Write one GatorVault Insider X post for a VERIFIED account (long-form OK). Target 600–900 characters (hard cap 1000).'
  );
  lines.push(
    'VOICE RULE (hard): This is GatorVault\'s take — not a beat recap. Absorb facts from the intel seed/board/film, then rewrite in original Vault voice. FORBIDDEN in the post: naming beat writers; "beat line"; "according to reports"; "per On3/247"; "as reported"; "reports say"; "insiders say"; and any meta flex about being different, exclusive, ahead of the timeline, or what other accounts skip. Just state the board + film. Board facts (ranks, RPM, visits, staff, commit status) and curated film traits may be stated as Vault fact.'
  );
  lines.push(
    'RIVAL RULE (hard): Speak about what Florida has going with this player. Rivals (Alabama, Georgia, etc.) are optional mid-post board context only — one calm fact (e.g. who leads RPM). Do NOT dunk on the opponent, do NOT frame Florida as waiting for a rival "inevitability" to break, and never close on the rival. Closer = Florida process (visits, staff, film, ownership).'
  );
  lines.push(
    'Structure: (1) Florida stake opener in Vault voice, (2) identity + On3 ranks/size/school, (3) if FILM / HIGHLIGHTS traits exist, weave 1–2 tape facts naturally, (4) Florida offer/staff/visits (rival RPM only as calm context if useful), (5) ownership/culture or visit detail, (6) sharp Florida-forward closer. Stay factual to board + intel + film above only — no invented offers, visits, rankings, tackle totals, or quotes. Respect "Do not claim" under FILM. UF voice, no banned claims. Prefer one dense post over a thread unless asked.'
  );

  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Full brief packet for Beat Desk UI + copy/paste.
 * Research always runs. Heavy inspect/compose only when opts.full === true.
 */
async function buildHubDeskBrief(slug, opts = {}) {
  const { parseHubDeskSlug, hubDeskLabel } = require('./hub-desk-topics');
  const normalized = normalizeSlug(slug);
  const hub = parseHubDeskSlug(normalized);
  if (!hub) return { ok: false, error: 'not_hub_topic' };

  await intelStore.initIntelStore().catch(() => {});
  const topicName = hubDeskLabel(hub.kind, hub.type);
  const liveRows = liveBeatRowsForPlayer(normalized, topicName, 12);
  const stored = (intelStore.listIntel({ limit: 200 }) || [])
    .filter((r) => {
      const et = String(r.eventType || r.triggerType || '');
      if (hub.kind === 'team') return et === 'team_event';
      return et === 'program_news';
    })
    .filter((r) => {
      const type = r.teamEventType || r.programNewsType || r.status || 'general';
      return String(type).replace(/-/g, '_') === hub.type || hub.type === 'general';
    })
    .slice(0, 12);
  const beatRows = mergeBeatRows(stored, liveRows);
  const primary = beatRows[0] || null;
  const seed = primary
    ? String(primary.detail || primary.skinny || primary.text || '').replace(/\s+/g, ' ').trim()
    : '';

  const whyFlorida = [
    `UF hub topic: ${topicName} (${hub.kind}/${hub.type}).`,
    seed ? `Latest beat seed: ${seed.slice(0, 280)}` : 'No live beat text on file — write from known UF program context only.',
    'This is team/program coverage — not a recruit board packet.'
  ].join(' ');

  const vaultAngle = [
    `Angle: Own today's ${topicName} story in Vault voice — Florida-first, original take, not a recap desk.`,
    seed
      ? `INTERNAL intel seed (absorb into Vault voice — NEVER name writers, never say beat/report/according to): "${seed.slice(0, 220)}"`
      : 'INTERNAL: no fresh seed — stay high-level on UF program momentum; do not invent hires, injuries, or scheme details.',
    'Vault edge: explain why this matters for Florida fans now (culture, roster, season timing) without inventing facts.'
  ].join('\n');

  const lines = [
    'GATORVAULT HUB BRIEF (team / program)',
    '====================================',
    `Topic: ${topicName}`,
    `Slug: ${normalized}`,
    `Kind: ${hub.kind}`,
    `Type: ${hub.type}`,
    '',
    'WHY FLORIDA',
    '-----------',
    whyFlorida,
    '',
    'VAULT ANGLE (own the story — Vault voice)',
    '-------------------------------',
    vaultAngle,
    '',
    'BEAT INTEL (newest first)',
    '------------------------'
  ];
  if (!beatRows.length) {
    lines.push('(no beat rows — keep copy general and factual)');
  } else {
    beatRows.slice(0, 8).forEach((row, i) => {
      const when = row.reportedAt || row.createdAt || '';
      const src = row.source || 'beat';
      const body = String(row.detail || row.skinny || row.text || '').trim();
      lines.push(`${i + 1}. [${when}] (${src})`);
      lines.push(body.slice(0, 500));
      if (row.articleUrl) lines.push(`Source: ${row.articleUrl}`);
      lines.push('');
    });
  }
  lines.push(
    '',
    'INSTRUCTIONS FOR AI',
    '-------------------',
    'Write one GatorVault Insider X post about this UF team/program topic (long-form OK). Target 600–900 characters (hard cap 1000).',
    'VOICE RULE (hard): GatorVault original take. FORBIDDEN: naming beat writers, "according to", "reports say", "per On3/247".',
    'Structure: (1) Florida stake opener, (2) what is happening for the program, (3) why fans should care now, (4) sharp closer.',
    'Stay factual to the beat seed above — no invented hires, firings, injuries, depth chart moves, or quotes.',
    'This is NOT a recruiting board post — skip RPM / offer ladder / OV checklist unless the seed explicitly has them.',
    '',
    'FUTURECAST FEED',
    '---------------',
    '(n/a — hub team/program topic, not a recruit target board write)'
  );

  const pasteText = lines.join('\n');
  return {
    ok: true,
    slug: normalized,
    playerName: topicName,
    deskKind: hub.kind,
    topicType: hub.type,
    hubTopic: true,
    updatedAt: new Date().toISOString(),
    player: null,
    whyFlorida,
    vaultAngle,
    boardFacts: '— (team/program hub brief)',
    futurecastFeed: { ok: true, skipped: true, reason: 'hub_topic' },
    pasteText,
    beat: primary
      ? {
          text: String(primary.detail || primary.skinny || '').slice(0, 1200),
          source: primary.source || null,
          reportedAt: primary.reportedAt || primary.createdAt || null,
          articleUrl: primary.articleUrl || null
        }
      : null
  };
}

async function buildBeatBrief(slug, opts = {}) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return { ok: false, error: 'missing_slug' };

  try {
    if (require('./hub-desk-topics').isHubDeskSlug(normalized)) {
      return buildHubDeskBrief(normalized, opts);
    }
  } catch {
    /* fall through to recruit brief */
  }

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

  if (research && isCommittedPlayer(player, research)) {
    research.ufPosition = 'committed';
    if (!research.eventType || research.eventType === 'target_update' || research.eventType === 'update' || research.eventType === 'trending') {
      research.eventType = 'commit_culture';
    }
  }

  const rivals = rivalList(player || {}, research, intelligence);

  let filmTraits = null;
  try {
    const filmStore = require('./film-traits-store');
    filmTraits = filmStore.resolveFilmTraits({
      slug: normalized,
      playerName,
      aliases: [player?.on3Slug, player?.slug].filter(Boolean),
    });
    // Auto-attach On3/Hudl highlight URLs when missing (traits still Vault-curated).
    if (opts.hydrateFilm !== false) {
      const ingest = require('./film-traits-ingest');
      if (ingest.needsSourceHydration(filmTraits)) {
        const hydrated = await ingest.hydrateFilmTraitsFromOn3({
          slug: normalized,
          playerName,
          player: player || null,
          classYear: player?.classYear || player?.year || null,
        });
        if (hydrated?.ok && hydrated.filmTraits) {
          filmTraits = { slug: hydrated.slug || normalized, ...hydrated.filmTraits };
        }
      }
    }
  } catch {
    filmTraits = null;
  }

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
    player: player || {},
    filmTraits,
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
    rivals,
    filmTraits,
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
      filmTraits: filmTraits
        ? {
            slug: filmTraits.slug || normalized,
            playerName: filmTraits.playerName || playerName,
            sources: filmTraits.sources || [],
            traits: filmTraits.traits || [],
            vaultFilmAngle: filmTraits.vaultFilmAngle || null,
            doNotClaim: filmTraits.doNotClaim || [],
            clipNotes: filmTraits.clipNotes || null,
          }
        : null,
      postGuidance: {
        verifiedLongForm: true,
        targetCharsMin: 600,
        targetCharsMax: 900,
        hardCap: 1000,
        structure: [
          'Florida stake opener',
          'On3 ranks / size / school identity',
          'Film traits when on file (Hudl/On3 highlights)',
          'Florida offer/staff/visits (rival RPM as calm context only)',
          'Visit or staff fact if on file',
          'Florida-forward closer (never rival punchline)'
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
    filmTraits: filmTraits
      ? {
          slug: filmTraits.slug || normalized,
          playerName: filmTraits.playerName || playerName,
          sources: filmTraits.sources || [],
          traits: filmTraits.traits || [],
          vaultFilmAngle: filmTraits.vaultFilmAngle || null,
          doNotClaim: filmTraits.doNotClaim || [],
          clipNotes: filmTraits.clipNotes || null,
        }
      : null,
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
  buildHubDeskBrief,
  formatBriefText,
  formatFilmTraitsBlock,
  buildWhyFlorida,
  buildVaultAngle,
  isCommittedPlayer,
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
