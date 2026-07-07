/**
 * Beat-fact extraction — visit, staff energy, quotes, RPM before angle/PR-789.
 */

const { resolveValidCompSchools, compLabel } = require('./comp-sourcing');

const MONTH_VISIT_RE =
  /\b(early\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const FOLLOW_UP_RE = /\bsince\s+(june\s+\d{1,2}|july\s+\d{1,2}|[a-z]+\s+\d{1,2})\b/i;

/** Reject possessive-apostrophe false positives (e.g. Gators' … country's). */
function isValidBeatQuote(q) {
  const quote = String(q || '').trim();
  if (quote.length < 12) return false;
  if (/^all three\.?$/i.test(quote)) return false;
  if (/^(yes|no|100 percent)\.?$/i.test(quote)) return false;
  if (/^(defensive back|coaching staff|the florida|florida gators)/i.test(quote)) return false;
  if (/\bcontinue standing out\b/i.test(quote)) return false;
  if (/\bprospects?\b/i.test(quote) && !/^I /i.test(quote)) return false;
  if (/^he'?s telling me\b/i.test(quote)) return false;
  if (/^man, you got to come down here/i.test(quote)) return false;
  if (/^you got to come down here/i.test(quote)) return false;
  return true;
}

function isReporterFramedQuote(quote = '') {
  const q = String(quote || '').trim();
  return (
    /^he'?s telling me\b/i.test(q) ||
    /^man, you got to come down here/i.test(q) ||
    /^you got to come down here/i.test(q)
  );
}

/** Quote is UF/staff message to the recruit — not player speech. */
function isStaffDirectedQuoteContext(beatText = '', quote = '') {
  const beat = String(beatText || '');
  const q = String(quote || '').trim().toLowerCase();
  if (!q) {
    return /\bflorida told\b/i.test(beat) || /\bgators told\b/i.test(beat) || /\btold .+ straight up\b/i.test(beat);
  }
  return (
    /\bflorida told\b/i.test(beat) ||
    /\bgators told\b/i.test(beat) ||
    /\btold .+ straight up\b/i.test(beat) ||
    (/\bwe want you\b/i.test(q) && /\bwe'?re going to get you\b/i.test(q))
  );
}

function visitLabelFromBeat(beatText = '', facts = {}) {
  const beat = String(beatText || '');
  if (/fnl|friday night lights/i.test(beat)) return 'FNL weekend in Gainesville';
  if (facts.visit?.when === 'his first Gainesville visit') return 'first Gainesville visit';
  if (facts.visit?.when) return `${facts.visit.when} visit to Gainesville`;
  if (/gainesville/i.test(beat)) return 'weekend in Gainesville';
  return 'campus visit to Gainesville';
}

function extractQuote(beatText = '') {
  const beat = String(beatText);
  const quotes = [];
  let m;

  const doubleRe = /["“]([^"”]+)["”]/g;
  while ((m = doubleRe.exec(beat)) !== null) {
    const q = (m[1] || '').trim();
    if (isValidBeatQuote(q)) quotes.push(q);
  }

  // Single-quoted speech only — not possessives like Gators' or country's.
  const singleRe = /(?:^|[\s([{>—–-])'([^']{12,220})'(?:[\s)\]}>.,!?;—–-]|$)/g;
  while ((m = singleRe.exec(beat)) !== null) {
    const q = (m[1] || '').trim();
    if (isValidBeatQuote(q)) quotes.push(q);
  }

  if (quotes.length) {
    return quotes.sort((a, b) => b.length - a.length)[0];
  }
  return extractSaysClause(beat);
}

/** Unquoted "says …" attribution — only when it reads like a full statement, not a fragment. */
function extractSaysClause(beatText = '') {
  const beat = String(beatText || '');
  const m = beat.match(
    /\bsays?\s+(?:Florida\s+has\s+)?(?:all three[^.!?—–-]{8,120}[.!?]?|[^.!?—–-]{20,160}[.!?])/i
  );
  if (!m) return null;
  let clause = String(m[0]).replace(/^\s*says?\s+/i, '').trim();
  clause = clause.replace(/\s*[—–-]\s*and after.*$/i, '').trim();
  if (clause.length < 20 || /^all three\.?$/i.test(clause)) return null;
  return clause.replace(/[.!?]+$/, '').trim();
}

function extractStaffContact(beatText = '') {
  const beat = String(beatText);
  return (
    /\ball three (?:of their )?db coach/i.test(beat) ||
    /\bdb coaches (?:are )?texting/i.test(beat) ||
    /\bcoaches texting (?:him|me)\b/i.test(beat) ||
    /\bdb staff.*texting/i.test(beat) ||
    /\bdb coach(?:es)? (?:are )?(?:in contact|texting|reaching)/i.test(beat) ||
    /\b(?:wr|qb|te|rb|dl|lb|edge|cb|s)\s+coach(?:es)?\b/i.test(beat) ||
    /\bcoach(?:es)?\s+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+){1,4}\s+building relationship/i.test(beat) ||
    /\bdaily (?:communication|contact|staff contact)\b/i.test(beat) ||
    /\btalk to them daily\b/i.test(beat) ||
    /\bmajor contender for\b/i.test(beat)
  );
}

function isDbStaffContactBeat(beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  return (
    /\ball three (?:of their )?db coach/i.test(beat) ||
    /\bdb coaches? (?:are )?texting/i.test(beat) ||
    /\bdb staff.*texting/i.test(beat) ||
    /\bdb coach(?:es)? (?:are )?(?:in contact|texting|reaching)/i.test(beat)
  );
}

function extractCoachNames(beatText = '') {
  const beat = String(beatText || '');
  const building = beat.match(/\bcoach(?:es)?\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+){1,4})\s+building relationship/i);
  if (building) {
    return building[1].split(/,\s*/).map((name) => name.trim()).filter(Boolean);
  }
  const texting = beat.match(/\b(?:all three )?(?:DB|WR|QB|TE|RB|DL|LB|EDGE|CB|S)\s+coach(?:es)?\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+){0,3})/i);
  if (texting) {
    return texting[1].split(/,\s*/).map((name) => name.trim()).filter(Boolean);
  }
  return [];
}

function extractStaffEnergy(beatText = '') {
  const beat = String(beatText).toLowerCase();
  return (
    /\benergy from the staff\b/i.test(beat) ||
    /\bstaff energy\b/i.test(beat) ||
    /\bloved the energy\b/i.test(beat) ||
    /\bappreciated the energy\b/i.test(beat) ||
    /\bdaily communication\b/i.test(beat) ||
    /\bdaily staff contact\b/i.test(beat) ||
    /\bbuilding relationship\b/i.test(beat) ||
    /\btrending with daily\b/i.test(beat) ||
    /\bstaff contact\b/i.test(beat)
  );
}

function extractVisit(beatText = '') {
  const beat = String(beatText);
  if (!/\b(on campus|visited|visit|trip|swamp|gainesville)\b/i.test(beat)) return null;

  let when = null;
  const month = beat.match(MONTH_VISIT_RE);
  if (month) when = month[0].trim();
  if (/early march/i.test(beat)) when = 'early March';
  if (/spring practice|this spring/i.test(beat)) when = when || 'this spring';
  if (/spring visit/i.test(beat)) when = when || 'spring';
  if (/first visit to gainesville|gainesville visit/i.test(beat)) when = 'his first Gainesville visit';
  else if (/first visit|first trip/i.test(beat)) when = when || (/first trip/i.test(beat) ? 'first trip' : 'first visit');
  if (/fnl|friday night lights/i.test(beat)) when = when || 'FNL weekend';

  const school = /\bflorida|gators|swamp|gainesville\b/i.test(beat) ? 'Florida' : null;
  const type = /\bofficial\b/i.test(beat) && !/unofficial/i.test(beat) ? 'official' : 'unofficial';

  return { when, type, school };
}

function extractFollowUpSince(beatText = '') {
  const m = String(beatText).match(FOLLOW_UP_RE);
  return m ? m[1] : null;
}

function extractBoardSignal(beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  return (
    /\btop of my board\b/i.test(beat) ||
    /\bon his board\b/i.test(beat) ||
    /\bleaderboard\b/i.test(beat) ||
    /\bcracked his\b/i.test(beat) ||
    /\bstrong position\b/i.test(beat) ||
    /\bqb board stretches\b/i.test(beat) ||
    /\bboard stretches\b/i.test(beat) ||
    /\bstretches all the way\b/i.test(beat) ||
    (/\btop schools?\b/i.test(beat) && !/\btop-\d+\b/i.test(beat))
  );
}

/** Cross-country / distance recruiting signals (Hawaii, obstacle, plenty to think about). */
function extractGeographicSignal(beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  return (
    /\ball the way to hawaii\b/i.test(beat) ||
    /\bcross[- ]country\b/i.test(beat) ||
    /\bdistance isn'?t much of an obstacle\b/i.test(beat) ||
    /\bproving distance\b/i.test(beat) ||
    (/\bhawaii\b/i.test(beat) && /\bboard stretches\b/i.test(beat)) ||
    (/\bplenty to think about\b/i.test(beat) && /\bboard stretches\b/i.test(beat))
  );
}

function enrichVisitFromContext(facts, ctx = {}) {
  const beat = String(facts.beatText || ctx.beatText || '');
  if (/first trip to gainesville|first visit to gainesville|first trip to the swamp/i.test(beat)) {
    return { when: 'his first Gainesville visit', type: 'unofficial', school: 'Florida' };
  }
  if (/made a big impression.*first trip|first trip.*gainesville|big impression.*gainesville/i.test(beat)) {
    return { when: 'his first Gainesville visit', type: 'unofficial', school: 'Florida' };
  }
  if (facts.visit?.when) {
    if (/gainesville/i.test(beat) && /^first trip$/i.test(String(facts.visit.when))) {
      return { ...facts.visit, when: 'his first Gainesville visit', school: facts.visit.school || 'Florida' };
    }
    return facts.visit;
  }
  const visits = ctx.intel?.visits || [];
  for (const v of visits) {
    const school = String(v.school || v.name || '').toLowerCase();
    if (/florida|gators|\buf\b/.test(school)) {
      return {
        when: v.when || v.label || 'campus',
        type: v.type || 'unofficial',
        school: 'Florida'
      };
    }
  }
  const slug = String(ctx.slug || '').trim().toLowerCase();
  if (slug && shouldUseVisitLogContext(beat, facts)) {
    try {
      const visitStore = require('../../recruiting-visit-log-store');
      const logs = visitStore.listVisitLogs({ playerSlug: slug, limit: 5 });
      const uf = logs.find((v) => /florida|gators|\buf\b/i.test(String(v.school || '')));
      if (uf) {
        const date = uf.date || uf.reportedAt;
        let when = 'Gainesville visit';
        if (date) {
          const d = new Date(date);
          if (Number.isFinite(d.getTime())) {
            const month = d.toLocaleString('en-US', { month: 'long' });
            when = `${month} trip to Gainesville`;
          }
        }
        return {
          when,
          type: uf.visitType || 'unofficial',
          school: 'Florida',
          source: 'visit_log'
        };
      }
    } catch {
      /* optional */
    }
  }
  return facts.visit;
}

function shouldUseVisitLogContext(beatText = '', facts = {}) {
  const beat = String(beatText || '').toLowerCase();
  if (
    /\bmaking .+ a priority early\b/i.test(beat) ||
    /\binterest is certainly mutual\b/i.test(beat) ||
    /\bteammates with a current florida commit\b/i.test(beat) ||
    /\blong before (?:his|the) offer\b/i.test(beat) ||
    /\bdidn'?t need an offer\b/i.test(beat)
  ) {
    return false;
  }
  return true;
}

function isHeadCoachOfferSignal(beatText = '', quote = '') {
  const blob = `${beatText} ${quote}`.toLowerCase();
  return (
    /\bhead coach\b/i.test(blob) &&
    (/\boffer\b/i.test(blob) || /\bsuper cool\b/i.test(blob) || /\bthat means a lot\b/i.test(blob))
  );
}

function headCoachLabel(beatText = '', quote = '') {
  const blob = `${beatText} ${quote}`;
  let official = {};
  try {
    official = require('../../official-coach-identity').readOfficial();
  } catch {
    official = {};
  }
  const currentHc = official?.coaches?.HC?.name || null;

  if (currentHc) {
    const hcRe = new RegExp(`\\b${currentHc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (hcRe.test(blob)) return currentHc;
    for (const alias of official?.coaches?.HC?.aliases || []) {
      const aliasRe = new RegExp(`\\b${String(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (aliasRe.test(blob)) return currentHc;
    }
  }

  // Quote/beat says "head coach" → verified current HC (Jon Sumrall in official-names.json).
  if (/\bhead coach\b/i.test(blob) && currentHc) return currentHc;

  for (const former of Object.values(official?.formerCoaches || {})) {
    const names = [former?.name, ...(former?.aliases || [])].filter(Boolean);
    for (const name of names) {
      const re = new RegExp(`\\b${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(blob)) return null;
    }
  }

  return null;
}

function extractOfferInterestSignal(beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  return (
    /\breally like the gators\b/i.test(beat) ||
    /\blong before (?:his|the) offer\b/i.test(beat) ||
    /\bdidn'?t need an offer\b/i.test(beat) ||
    /\bhad his attention long before\b/i.test(beat) ||
    /\bfirmly on his radar\b/i.test(beat) ||
    /\bmaking .+ a priority early\b/i.test(beat) ||
    /\binterest is certainly mutual\b/i.test(beat) ||
    /\bmutual interest\b/i.test(beat) ||
    /\btold .+ straight up\b/i.test(beat) ||
    /\bnow a top school\b/i.test(beat) ||
    /\bwe want you and we'?re going to get you\b/i.test(beat) ||
    /\bteammates with a current florida commit\b/i.test(beat) ||
    /\bhead coach\b/i.test(beat) ||
    /\bcoming from the head coach\b/i.test(beat) ||
    /\boffer was super cool\b/i.test(beat)
  );
}

/** On3 team-news prose — staff/tradition standing out without a visit or player quote. */
function extractProgramPitchSignal(beatText = '') {
  const beat = String(beatText).toLowerCase();
  return (
    /\bstanding out\b/i.test(beat) ||
    /\bfast start\b/i.test(beat) ||
    (/\bcoaching staff\b/i.test(beat) &&
      /\b(defensive back|db coach|db history|db tradition|history and coaching)\b/i.test(beat))
  );
}

function extractBeatCompBattle(beatText = '') {
  return /\b(battle|separate|against|competing|race|mix)\b/i.test(String(beatText));
}

function classifySignals(facts = {}) {
  const signals = [];
  if (facts.staffPitch) signals.push('staff_pitch');
  if (facts.staffEnergy) signals.push('staff_energy');
  if (facts.quote) signals.push('quote_driven');
  if (facts.visit?.when || facts.visit?.school) signals.push('visit');
  if (facts.boardSignal) signals.push('board');
  if (facts.programPitch) signals.push('program_pitch');
  if (facts.offerInterest) signals.push('offer_interest');
  if (facts.geographicSignal) signals.push('geographic');
  if (facts.rpmTop?.length) signals.push('competition');
  if (facts.beatCompBattle) signals.push('competition');
  if (facts.headCoachOffer) signals.push('head_coach_offer');
  if (facts.followUpSince) signals.push('follow_up');
  return [...new Set(signals)];
}

function selectAngleFromFacts(facts = {}, beatText = '') {
  const signals = facts.signals || classifySignals(facts);
  const beat = String(beatText || facts.beatText || '').toLowerCase();

  if (facts.geographicSignal && facts.boardSignal && facts.quote) {
    return { angle: 'board', reason: 'geographic_board_quote', signals };
  }
  if (facts.geographicSignal && facts.boardSignal) {
    return { angle: 'board', reason: 'geographic_board', signals };
  }
  if (/swamp|first trip/i.test(beat) && facts.quote && facts.boardSignal) {
    return { angle: 'visit', reason: 'swamp_quote_board', signals };
  }
  if (facts.boardSignal && facts.quote && /board stretches|plenty to think about/i.test(beat)) {
    return { angle: 'board', reason: 'board_stretch_quote', signals };
  }

  if (
    facts.staffPitch &&
    (facts.visit?.school || facts.boardSignal || /gainesville|fnl|friday night lights/i.test(beat))
  ) {
    return { angle: 'staff_pitch', reason: 'uf_direct_pitch_visit_board', signals };
  }
  if (facts.staffPitch) {
    return { angle: 'staff_pitch', reason: 'uf_direct_pitch', signals };
  }

  if (facts.staffContact && isDbStaffContactBeat(beat) && (facts.visit?.when || facts.boardSignal)) {
    return { angle: 'staff_contact', reason: 'staff_contact_visit_board', signals };
  }
  if (facts.staffContact && isDbStaffContactBeat(beat)) {
    return { angle: 'staff_contact', reason: 'staff_contact', signals };
  }

  if (
    (facts.staffContact || facts.staffEnergy) &&
    facts.followUpSince &&
    (facts.visit?.when || facts.visit?.school || /\b(on campus|campus visit|visit)\b/i.test(beat))
  ) {
    return { angle: 'staff', reason: 'staff_outreach_visit_followup', signals };
  }
  if (facts.staffContact && !isDbStaffContactBeat(beat)) {
    return { angle: 'staff', reason: 'staff_unit_outreach', signals };
  }

  if (facts.staffEnergy && (facts.quote || facts.followUpSince)) {
    return { angle: 'staff', reason: 'staff_energy_quote_or_followup', signals };
  }
  if (facts.staffEnergy && facts.visit?.when) {
    return { angle: 'staff', reason: 'staff_energy_visit', signals };
  }

  const playerQuote = facts.quote && !isReporterFramedQuote(facts.quote) ? facts.quote : null;
  if (playerQuote && (facts.headCoachOffer || isHeadCoachOfferSignal(beat, playerQuote))) {
    return { angle: 'head_coach_offer', reason: 'head_coach_offer_quote', signals };
  }
  if (
    playerQuote &&
    facts.visit?.when === 'this spring' &&
    /spring practice/i.test(beat) &&
    facts.boardSignal
  ) {
    return { angle: 'board', reason: 'spring_practice_board_quote', signals };
  }
  if (playerQuote && facts.visit?.when && facts.visit?.source !== 'visit_log') {
    return { angle: 'visit', reason: 'visit_with_player_quote', signals };
  }
  if (playerQuote && (facts.offerInterest || /really like the gators/i.test(beat))) {
    return { angle: 'player_quote', reason: 'player_quote_interest', signals };
  }
  if (playerQuote) {
    return { angle: 'player_quote', reason: 'player_quote', signals };
  }

  if (facts.boardSignal && facts.visit?.when) {
    return { angle: 'visit', reason: 'visit_board_signal', signals };
  }
  if (facts.visit?.when && !facts.staffEnergy) {
    return { angle: 'visit', reason: 'dated_visit', signals };
  }
  if (facts.rpmTop?.length && facts.beatCompBattle) {
    return { angle: 'competition', reason: 'rpm_battle_framed', signals };
  }
  if (facts.rpmTop?.length && facts.visit?.when) {
    return { angle: 'competition', reason: 'rpm_with_visit', signals };
  }
  if (facts.boardSignal) return { angle: 'board', reason: 'board_only', signals };
  if (facts.offerInterest) return { angle: 'player_quote', reason: 'offer_interest', signals };
  if (facts.programPitch) return { angle: 'program_pitch', reason: 'program_pitch', signals };
  if (facts.visit?.when) return { angle: 'visit', reason: 'visit_fallback', signals };

  return { angle: 'program_pitch', reason: 'minimal_facts', signals };
}

const { resolveUfCommitTeammate } = require('./uf-commit-teammate');

function extractBeatFacts(beatText = '', ctx = {}) {
  const beat = String(beatText || ctx.beatText || '').trim();
  const signal = ctx.signal || {};
  const metrics = ctx.metrics || signal.metrics || {};
  const player = ctx.player || signal.player || {};
  const intel = ctx.intel || null;
  const slug = ctx.slug || signal.playerSlug || null;
  const playerRow = ctx.playerRow || null;

  const compPack = resolveValidCompSchools({
    beatText: beat,
    metrics,
    intel,
    player
  });

  const rpmTop = compPack.rpmTop.length ? compPack.rpmTop : [];
  const rawQuote = extractQuote(beat);
  const staffDirected = isStaffDirectedQuoteContext(beat, rawQuote);

  const facts = {
    visit: extractVisit(beat),
    staffContact: extractStaffContact(beat),
    staffEnergy: extractStaffEnergy(beat),
    followUpSince: extractFollowUpSince(beat),
    quote: staffDirected ? null : rawQuote,
    staffQuote: staffDirected ? rawQuote : null,
    staffPitch:
      staffDirected ||
      /\btold .+ straight up\b/i.test(beat) ||
      /\bwe want you and we'?re going to get you\b/i.test(beat),
    rpmTop,
    ufRpmPct:
      metrics.ufRpmPct != null
        ? Number(metrics.ufRpmPct)
        : metrics.ufProbability != null
          ? Number(metrics.ufProbability)
          : metrics.rpm != null
            ? Number(metrics.rpm)
            : null,
    compSchools: compPack.schools,
    offerSchools: (intel?.offers || []).map((o) => o.school).filter(Boolean),
    visitSchools: (intel?.visits || []).map((v) => v.school).filter(Boolean),
    boardSignal: extractBoardSignal(beat),
    geographicSignal: extractGeographicSignal(beat),
    offerInterest: extractOfferInterestSignal(beat),
    programPitch: extractProgramPitchSignal(beat),
    headCoachOffer: isHeadCoachOfferSignal(beat, staffDirected ? null : rawQuote),
    ufCommitTeammate: resolveUfCommitTeammate({
      slug,
      playerRow,
      player,
      beatText: beat,
      roster: ctx.recruitingRoster,
      intel: ctx.intel || intel
    }),
    provenance: {
      visit: extractVisit(beat) ? 'beat' : null,
      staffContact: extractStaffContact(beat) ? 'beat' : null,
      staffEnergy: extractStaffEnergy(beat) ? 'beat' : null,
      quote: extractQuote(beat) ? 'beat' : null,
      rpmTop: rpmTop.length ? (metrics.rpmTop ? 'metrics' : 'intel') : null
    }
  };

  facts.beatText = beat;
  facts.visit = enrichVisitFromContext(facts, { ...ctx, beatText: beat });
  facts.signals = classifySignals(facts);
  facts.compLabel = compLabel(facts.compSchools);

  return facts;
}

function shortenQuote(quote) {
  if (!quote) return null;
  const q = String(quote).trim();
  if (q.length <= 60) return q;
  return q.replace(/^I /, '').slice(0, 57).trim() + '…';
}

/** Third-person insider paraphrase — never leave first-person "I saw" in publish copy. */
function paraphraseBeatQuote(quote) {
  if (!quote) return null;
  let q = String(quote).replace(/[."]+$/, '').trim();
  if (/^I loved the energy/i.test(q)) {
    return 'loved the energy he saw from UF staff';
  }
  if (/^I /i.test(q)) {
    q = q.replace(/^I /i, '');
  }
  q = q.replace(/\bthat I saw\b/i, 'from UF staff');
  return q.trim();
}

function quoteToInsiderLine(quote) {
  const paraphrase = paraphraseBeatQuote(quote);
  if (!paraphrase) return null;
  return `He said he ${paraphrase.charAt(0).toLowerCase()}${paraphrase.slice(1)}.`;
}

function quoteForEliteEmbed(quote) {
  if (!quote) return null;
  const q = String(quote)
    .replace(/["""]+$/, '')
    .replace(/[."]+$/, '')
    .trim()
    .replace(/^I /i, '');
  if (q.length < 12 || /^all three\.?$/i.test(q)) return null;
  return q;
}

function thirdPersonQuoteClause(quote) {
  let q = String(quote || '')
    .replace(/["""]+$/, '')
    .replace(/[."]+$/, '')
    .trim();
  if (!q || isReporterFramedQuote(q)) return null;
  if (/^I really like the Gators\.?$/i.test(q)) return 'he really likes the Gators';
  if (/^I really like the gators\.?$/i.test(q)) return 'he really likes the Gators';
  if (/^I love the Gators\.?$/i.test(q)) return 'he loves the Gators';
  if (/^I loved the energy/i.test(q)) return 'he loved the energy he saw from UF staff';
  if (/^Definitely one of my top schools/i.test(q)) return 'he said "Definitely one of my top schools"';
  if (/^I /i.test(q)) {
    q = q.replace(/^I /i, 'he ');
    q = q.replace(/\blike the Gators\b/i, 'likes the Gators');
    q = q.replace(/\blove the Gators\b/i, 'loves the Gators');
    return q;
  }
  if (/^Florida is /i.test(q)) {
    const tail = q.replace(/^Florida is /i, '').trim();
    return tail ? `Florida is ${tail}` : null;
  }
  if (/^all three/i.test(q) && /db coach|texting/i.test(q)) return null;
  if (/^Man, you got to/i.test(q)) return null;
  if (/atmosphere.*nothing like it|nothing like it.*atmosphere/i.test(q)) {
    return 'the atmosphere is unlike anything else';
  }
  if (/top schools?|top of my board/i.test(q)) return `he said "${q}"`;
  if (/\bwe want you\b/i.test(q) && /\bwe'?re going to get you\b/i.test(q)) return null;
  if (!/^I /i.test(q) && q.length >= 12) return `he said "${q}"`;
  return null;
}

/** Beat-accurate quote embed — clean third-person, no nested broken quotes. */
function formatEliteQuoteEmbed(quote) {
  const clause = thirdPersonQuoteClause(quote);
  if (!clause) return null;
  if (/^he said "/i.test(clause)) {
    return ` — ${clause}.`;
  }
  if (/^Florida is /i.test(clause)) {
    const tail = clause.replace(/^Florida is /i, '').trim();
    if (!tail) return null;
    return ` — he said Florida is ${tail}.`;
  }
  if (/^he /i.test(clause)) {
    return ` — he said ${clause}.`;
  }
  return ` — he said ${clause}.`;
}

function eliteTakeaway(facts, angle) {
  if (angle === 'staff_contact') return 'the staff attention is real';
  if (angle === 'staff' && facts.staffEnergy) {
    if (facts.quote && /energy/i.test(String(facts.quote))) return 'the staff sell is landing';
    return 'the staff sell is landing';
  }
  if (angle === 'board' && facts.boardSignal) return 'UF is on his board early';
  if (angle === 'visit' && facts.visit?.when) return 'UF is clearly in the picture after that first look';
  if (facts.rpmTop?.length) return 'Florida is still firmly in the mix';
  return 'UF is clearly still in the mix';
}

/** RPM close — when UF is second on the full board, say so honestly. */
function formatEliteRpmClause(facts, angle = 'staff_contact') {
  if (!(facts.rpmTop?.length >= 1)) return null;
  const ufPct = facts.ufRpmPct != null ? Number(facts.ufRpmPct) : null;
  const leader = facts.rpmTop[0];
  const second = facts.rpmTop[1];
  const takeaway = eliteTakeaway(facts, angle);

  if (ufPct != null && Number.isFinite(ufPct) && leader?.school) {
    const secondPct = second?.pct != null ? Number(second.pct) : 0;
    if (ufPct > secondPct) {
      return `. ${leader.school} leads his RPM board, but Florida is second at ${Math.round(ufPct)}% — and ${takeaway}.`;
    }
  }

  if (facts.rpmTop.length >= 2) {
    return `. ${leader.school} and ${second.school} lead his RPM board right now, but UF is clearly in the mix because ${takeaway}.`;
  }

  return `. ${leader.school} leads his RPM board, but UF is clearly in the mix because ${takeaway}.`;
}

function composeEliteStaffContactArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  const firstGainesville =
    facts.visit?.when === 'his first Gainesville visit' || /first visit to gainesville|first trip to gainesville/i.test(beat);

  let paragraph;
  if (firstGainesville) {
    paragraph = `${ln}'s first trip to Gainesville gave Florida a clean early look, and all three DB coaches on UF's staff have been in contact — that's the signal here`;
  } else {
    const when = facts.visit?.when === 'first trip' ? 'first trip' : facts.visit?.when || 'Gainesville trip';
    paragraph = `${ln}'s ${when} gave Florida an early look, and all three DB coaches on UF's staff have been in contact — that's the signal here`;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    const rpmClause = formatEliteRpmClause(facts, 'staff_contact');
    if (rpmClause) paragraph += rpmClause;
  } else if (!paragraph.endsWith('.')) {
    paragraph += '.';
  }

  return paragraph;
}

function composeEliteStaffArc(facts, ln, opts = {}, beatText = '') {
  const beat = String(beatText || facts.beatText || '');
  const coachNames = extractCoachNames(beat);
  const unitMatch = beat.match(/\b(WR|QB|DB|DL|TE|RB|LB|EDGE|CB|S)\s+coach(?:es)?\b/i);
  const visitWhen = facts.visit?.when === 'his first Gainesville visit' ? 'Gainesville' : facts.visit?.when || 'campus';

  if (!opts.eliteShort && coachNames.length >= 2) {
    const unit = unitMatch ? unitMatch[1].toUpperCase() : 'position';
    const nameList =
      coachNames.length > 2
        ? `${coachNames.slice(0, -1).join(', ')}, and ${coachNames[coachNames.length - 1]}`
        : coachNames.join(' and ');
    let paragraph = `Florida's ${unit} staff has been in daily contact with ${ln}`;
    if (facts.followUpSince) paragraph += ` since ${facts.followUpSince}`;
    paragraph += ` — ${nameList} are driving serious early interest after his ${visitWhen} visit.`;
    if (facts.quote) {
      const embed = formatEliteQuoteEmbed(facts.quote);
      if (embed) paragraph += embed;
    }
    if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
      paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix.`;
    }
    return paragraph;
  }

  if (opts.eliteShort) {
    let paragraph = `${ln}'s ${visitWhen} UF visit — staff energy drives this`;
    if (facts.quote) {
      const embed = formatEliteQuoteEmbed(facts.quote);
      if (embed) paragraph += embed.replace(/^ — /, '. ');
      else {
        const embedded = quoteForEliteEmbed(facts.quote);
        if (embedded) paragraph += `. He said he "${embedded}."`;
      }
    }
    const hasRpm = facts.rpmTop?.length >= 2 && !opts.trimComp;
    if (facts.followUpSince) {
      if (facts.staffEnergy && !hasRpm) {
        paragraph += ` The pitch picked up since ${facts.followUpSince}, and staff sell is landing.`;
      } else {
        paragraph += ` The pitch picked up since ${facts.followUpSince}.`;
      }
    } else if (facts.staffEnergy && !hasRpm) {
      paragraph += `, and staff sell is landing.`;
    }
    if (hasRpm) {
      paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead RPM, and staff sell is landing.`;
    }
    return paragraph;
  }

  let paragraph = `${ln} was on Florida's campus in ${visitWhen}, and staff energy is still the story`;

  if (facts.quote) {
    const embed = formatEliteQuoteEmbed(facts.quote);
    if (embed) paragraph += embed;
  } else if (facts.staffEnergy) {
    paragraph += ` — and he loved the energy from UF's staff`;
  }

  if (facts.followUpSince) {
    if (!paragraph.endsWith('.')) paragraph += '.';
    paragraph += opts.trimFollowUp
      ? ` That pitch picked up since ${facts.followUpSince}.`
      : ` That same pitch has only picked up since ${facts.followUpSince}.`;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    const takeaway = opts.trimTakeaway ? null : eliteTakeaway(facts, 'staff');
    paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix`;
    paragraph += takeaway ? ` because ${takeaway}.` : '.';
  } else if (facts.rpmTop?.length === 1 && !opts.trimComp) {
    paragraph += ` ${facts.rpmTop[0].school} leads his RPM board, but UF is clearly in the mix.`;
  } else if (facts.staffEnergy) {
    paragraph += ` UF is clearly in the mix because ${eliteTakeaway(facts, 'staff')}.`;
  }

  return paragraph;
}

function composeEliteProgramPitchArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  let paragraph;
  if (/defensive back history|db history|db tradition/i.test(beat)) {
    paragraph = `Florida's DB tradition and staff pitch are standing out early with ${ln}, and UF has real traction in his mix`;
  } else if (/standing out/i.test(beat)) {
    paragraph = `Florida's staff pitch is standing out early with ${ln}, and UF has real traction in his mix`;
  } else {
    paragraph = `Florida is building early traction with ${ln}, and the staff pitch is landing`;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += `. ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the picture.`;
  } else if (!paragraph.endsWith('.')) {
    paragraph += '.';
  }
  return paragraph;
}

function composeEliteVisitArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  const swampTrip = /swamp|first trip/i.test(beat);
  let paragraph;

  if (!facts.visit?.when && !/\b(on campus|visited|visit|trip|swamp|gainesville)\b/i.test(beat)) {
    return composeEliteProgramPitchArc(facts, ln, beatText, opts);
  }

  if (swampTrip) {
    paragraph = `${ln}'s first trip to The Swamp gave Florida early traction`;
  } else {
    const when = facts.visit?.when || 'campus';
    paragraph = `${ln} was on Florida's campus in ${when}, and that trip put UF in his early mix with real traction`;
  }

  if (facts.quote) {
    const embed = formatEliteQuoteEmbed(facts.quote);
    if (embed) paragraph += embed;
  } else if (swampTrip && !facts.quote) {
    paragraph += ` — and he left with the Gators on his board early`;
  }

  if (!facts.quote && facts.boardSignal && !swampTrip) {
    paragraph += ` He's already listing Florida among his top schools.`;
  }

  if (facts.followUpSince) {
    if (!paragraph.endsWith('.')) paragraph += '.';
    paragraph += opts.trimFollowUp
      ? ` That pitch picked up since ${facts.followUpSince}.`
      : ` That same pitch has only picked up since ${facts.followUpSince}.`;
  } else if (facts.staffEnergy && !facts.quote) {
    paragraph += swampTrip
      ? ` — and he loved the energy from UF's staff.`
      : ` — and he loved the energy from UF's staff.`;
  } else if (facts.staffEnergy && facts.visit?.when === 'this spring') {
    paragraph += `, and the staff has kept that lane warm since spring.`;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the picture after that first look.`;
  } else if (!paragraph.endsWith('.') && !paragraph.endsWith('."')) {
    paragraph += '.';
  }

  return paragraph;
}

function composeEliteHeadCoachOfferArc(facts, ln, beatText = '', opts = {}) {
  const coach = headCoachLabel(beatText, facts.quote);
  let paragraph;
  if (coach && coach !== 'the head coach') {
    paragraph = `Florida's offer carried extra weight for ${ln} — hearing it directly from ${coach} made the moment stand out`;
  } else if (coach === 'the head coach') {
    paragraph = `Florida's offer carried extra weight for ${ln} — getting it straight from the head coach made the moment stand out`;
  } else {
    paragraph = `Florida's offer landed with real priority for ${ln}, and the Gators are pressing early`;
  }

  const embed = formatEliteQuoteEmbed(facts.quote);
  if (embed) {
    paragraph += embed;
  } else if (!paragraph.endsWith('.')) {
    paragraph += '.';
  }

  if (facts.visit?.when) {
    paragraph += ` UF is building on his ${facts.visit.when}`;
    if (!/visit|trip/i.test(facts.visit.when)) paragraph += ' visit';
    paragraph += ' and pressing early in this cycle.';
  } else {
    paragraph += ' UF is pressing early with real conviction in this cycle.';
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix.`;
  }

  return paragraph;
}

function composeElitePlayerQuoteArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  let paragraph;
  if (/making .+ a priority early|interest is certainly mutual/i.test(beat)) {
    paragraph = `Florida is making ${ln} a priority early, and the mutual interest is real`;
    if (/teammates with a current florida commit/i.test(beat) && facts.ufCommitTeammate?.name) {
      paragraph += ` — especially with UF commit ${facts.ufCommitTeammate.name} already in his circle`;
    }
  } else if (/long before.*offer|didn'?t need an offer|before (?:his|the) offer|attention before the offer/i.test(beat)) {
    paragraph = `Florida had ${ln}'s attention before the offer landed, and UF is already in his mix`;
  } else if (/firmly on his radar/i.test(beat)) {
    paragraph = `Florida is firmly on ${ln}'s radar early in his recruitment`;
  } else if (facts.boardSignal && facts.geographicSignal) {
    return composeEliteGeographicBoardArc(facts, ln, beatText, opts);
  } else if (facts.boardSignal) {
    paragraph = `${ln} has Florida on his board early in this cycle`;
  } else if (facts.geographicSignal) {
    paragraph = `Florida is showing cross-country interest in ${ln} early in his recruitment`;
  } else if (facts.programPitch) {
    return composeEliteProgramPitchArc(facts, ln, beatText, opts);
  } else if (facts.quote) {
    paragraph = `Florida has early interest in ${ln}, and the Gators are in his mix`;
  } else if (facts.visit?.when) {
    paragraph = `${ln}'s ${facts.visit.when} visit to Florida put the Gators on his radar early`;
  } else {
    return null;
  }

  if (!paragraph) return null;

  const embed = formatEliteQuoteEmbed(facts.quote);
  if (embed) {
    paragraph += embed;
  } else if (!paragraph.endsWith('.')) {
    paragraph += '.';
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += `. ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix.`;
  } else if (!paragraph.endsWith('.') && !paragraph.endsWith('."')) {
    paragraph += '.';
  }

  return paragraph;
}

function composeEliteGeographicBoardArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  let paragraph;
  if (facts.visit?.when === 'his first Gainesville visit' || /first trip to gainesville|big impression.*gainesville/i.test(beat)) {
    paragraph = `${ln}'s first trip to Gainesville left an impression, and Florida has him on the QB board early despite the distance`;
  } else if (/qb board stretches|board stretches|stretches all the way/i.test(beat)) {
    paragraph = `Florida's QB board stretches cross-country to ${ln}, and the Gators are giving him plenty to think about early`;
  } else if (facts.geographicSignal) {
    paragraph = `Florida is pushing cross-country with ${ln} early, and UF has him on the board despite the distance`;
  } else {
    paragraph = `${ln} has Florida on his board early in this cycle`;
  }

  if (facts.quote) {
    const embed = formatEliteQuoteEmbed(facts.quote);
    if (embed) paragraph += embed;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += `. ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix early.`;
  } else if (!paragraph.endsWith('.') && !paragraph.endsWith('."')) {
    paragraph += '.';
  }

  return paragraph;
}

function composeEliteStaffPitchArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || facts.beatText || '');
  const visitLabel = visitLabelFromBeat(beat, facts);
  let paragraph = `Florida's staff didn't hold back with ${ln} after his ${visitLabel}`;

  if (facts.staffQuote) {
    const q = quoteForEliteEmbed(facts.staffQuote) || String(facts.staffQuote).replace(/[."]+$/, '').trim();
    paragraph += ` — they told him straight up: "${q}."`;
  } else {
    paragraph += ` — the Gators made their priority crystal clear.`;
  }

  if (facts.boardSignal || /\btop school\b/i.test(beat)) {
    paragraph += ` UF is now squarely among his top schools in this cycle.`;
  } else if (facts.offerInterest) {
    paragraph += ` UF is pushing hard as an early priority in this cycle.`;
  } else {
    paragraph += ` UF is pressing early with real conviction.`;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix.`;
  }

  return paragraph;
}

function composeEliteBoardArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  if (facts.geographicSignal || /board stretches|stretches all the way/i.test(beat)) {
    return composeEliteGeographicBoardArc(facts, ln, beatText, opts);
  }
  let paragraph;
  if (/spring practice/i.test(beat) && facts.visit?.when === 'this spring') {
    paragraph = `${ln}'s spring practice visit has Florida among his top schools on his board early`;
  } else if (facts.visit?.when) {
    paragraph = `${ln}'s ${facts.visit.when} campus visit has Florida in his top-school mix on his board early`;
  } else {
    paragraph = `${ln} has Florida in his top-school mix on his board early`;
  }

  if (facts.quote) {
    const embed = formatEliteQuoteEmbed(facts.quote);
    if (embed) paragraph += embed;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += `. ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix early.`;
  } else if (!paragraph.endsWith('.') && !paragraph.endsWith('."')) {
    paragraph += '.';
  }

  return paragraph;
}

function composeEliteCompetitionArc(facts, ln, opts = {}) {
  const when = facts.visit?.when;
  const comps = facts.compLabel;
  let paragraph;

  if (when && comps) {
    paragraph = `${ln}'s ${when} visit gave Florida traction while ${comps} stay in the mix — and UF is pressing because the staff connection is real.`;
  } else if (comps) {
    paragraph = `Florida is gaining traction with ${ln} while ${comps} stay in the mix — and the Gators are pressing early in this cycle.`;
  } else if (facts.rpmTop?.length >= 2) {
    paragraph = `${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix because ${eliteTakeaway(facts, 'competition')}.`;
  } else {
    paragraph = `${ln}'s visit gave Florida traction in a crowded race — and UF is pressing early.`;
  }

  if (opts.trimComp && facts.rpmTop?.length >= 2) {
    paragraph = paragraph.replace(/\s+(Auburn|Vanderbilt|Florida State|Georgia)[^.]+\./g, '.');
  }

  return paragraph;
}

function composeEliteArc(facts, anglePick, ln, beatText = '', opts = {}) {
  switch (anglePick.angle) {
    case 'staff_contact':
      return composeEliteStaffContactArc(facts, ln, beatText, opts);
    case 'staff':
      return composeEliteStaffArc(facts, ln, opts, beatText);
    case 'staff_pitch':
      return composeEliteStaffPitchArc(facts, ln, beatText, opts);
    case 'board':
      return composeEliteBoardArc(facts, ln, beatText, opts);
    case 'competition':
      return composeEliteCompetitionArc(facts, ln, opts);
    case 'program_pitch':
      return composeEliteProgramPitchArc(facts, ln, beatText, opts);
    case 'head_coach_offer':
      return composeEliteHeadCoachOfferArc(facts, ln, beatText, opts);
    case 'player_quote':
      return composeElitePlayerQuoteArc(facts, ln, beatText, opts);
    case 'visit':
    default:
      return composeEliteVisitArc(facts, ln, beatText, opts);
  }
}

function composeStaffArc(facts, ln, opts = {}, beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  if (/db coach|coaches texting/i.test(beat)) {
    return `Florida's DB staff leaned in hard on ${ln} after his Gainesville trip, and that contact pushed UF onto his early board with real energy.`;
  }

  const visitWhen = facts.visit?.when === 'his first Gainesville visit' ? 'Gainesville' : facts.visit?.when || 'campus';
  const quote = facts.quote ? String(facts.quote).replace(/[."]+$/, '').trim() : null;
  const parts = [];
  parts.push(`${ln} was on Florida's campus in ${visitWhen}, and staff energy is still the story.`);

  if (quote) {
    if (opts.compact && /energy/i.test(quote)) {
      parts.push(`He loved the energy he saw from UF staff.`);
    } else {
      const insider = quoteToInsiderLine(quote);
      if (insider) parts.push(insider);
    }
  } else if (facts.staffEnergy) {
    parts.push(`He appreciated the energy from UF's staff on that trip.`);
  }

  if (facts.followUpSince) {
    parts.push(
      opts.compact
        ? `That pitch picked up since ${facts.followUpSince}.`
        : `That pitch has only picked up since ${facts.followUpSince}.`
    );
  }

  if (facts.rpmTop?.length >= 2 && !opts.angleArc) {
    parts.push(
      `${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead RPM, but UF stays in the mix.`
    );
  } else if (facts.rpmTop?.length === 1 && !opts.angleArc) {
    parts.push(`${facts.rpmTop[0].school} leads his RPM board, but UF is still in the mix.`);
  }

  return parts.join(' ');
}

function composeVisitArc(facts, ln, beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  const when = facts.visit?.when || 'campus';
  if (/swamp|first trip/i.test(beat)) {
    return `${ln}'s first trip to The Swamp gave Florida real traction, and he left with the Gators on his board early.`;
  }
  if (facts.boardSignal && facts.quote) {
    return `${ln}'s ${when} trip to Florida put the Gators on his board, and he's already calling UF one of his top schools.`;
  }
  return `${ln} was on Florida's campus in ${when}, and that trip put UF in his early mix with real traction.`;
}

function composeBoardArc(facts, ln, beatText = '') {
  const beat = String(beatText || '').toLowerCase();
  if (/spring practice/i.test(beat) && facts.visit?.when === 'this spring') {
    return `${ln} was on campus this spring watching Florida's spring practice, and he's listing the Gators among his top schools.`;
  }
  if (facts.quote && /top schools/i.test(String(facts.quote))) {
    return `${ln} is listing Florida among his top schools after his ${facts.visit?.when || 'recent'} campus time.`;
  }
  return `${ln} has Florida in his top-school mix after spring campus time, and the Gators are positioned early with him.`;
}

function composeCompetitionArc(facts, ln) {
  const comps = facts.compLabel;
  const when = facts.visit?.when;
  if (when && comps) {
    return `${ln}'s ${when} visit gave Florida traction while ${comps} stay in the mix, and UF is pressing because the staff connection is real.`;
  }
  if (comps) {
    return `Florida is gaining traction with ${ln} while ${comps} stay in the mix, and UF is pressing early in this cycle.`;
  }
  return `${ln}'s visit gave Florida traction in a crowded race, and UF is pressing early.`;
}

function composeFromFacts(facts = {}, anglePick = {}, ctx = {}, opts = {}) {
  const ln = ctx.lastName || 'He';
  const angle = anglePick.angle || 'visit';

  if (opts.mode === 'elite') {
    const narrative = composeEliteArc(facts, anglePick, ln, ctx.beatText, opts);
    if (!narrative) return { narrative: null, narrative1: null, narrative2: null, angle: anglePick.angle };
    return { narrative, narrative1: narrative, narrative2: null, angle: anglePick.angle };
  }

  let narrative;

  switch (angle) {
    case 'staff_contact':
      narrative = composeStaffArc(facts, ln, opts, ctx.beatText);
      break;
    case 'staff':
      narrative = composeStaffArc(facts, ln, opts, ctx.beatText);
      break;
    case 'staff_pitch':
      narrative = composeEliteStaffPitchArc(facts, ln, ctx.beatText, opts);
      break;
    case 'board':
      narrative = composeBoardArc(facts, ln, ctx.beatText);
      break;
    case 'competition':
      narrative = composeCompetitionArc(facts, ln);
      break;
    case 'visit':
    default:
      narrative = composeVisitArc(facts, ln, ctx.beatText);
      break;
  }

  if (opts.mode === 'dual') {
    if (angle === 'staff') {
      const visitWhen = facts.visit?.when || 'campus';
      const quote = facts.quote ? String(facts.quote).replace(/[."]+$/, '').trim() : null;
      let narrative1 = `${ln} was on Florida's campus in ${visitWhen}, and staff energy is still the story.`;
      if (quote) {
        const insider = quoteToInsiderLine(quote);
        if (insider) narrative1 += ` ${insider}`;
      }
      let narrative2 = facts.followUpSince
        ? `That pitch has picked up since ${facts.followUpSince}.`
        : null;
      if (facts.rpmTop?.length >= 2) {
        const comp = `${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead RPM, but UF stays in the mix.`;
        narrative2 = narrative2 ? `${narrative2} ${comp}` : comp;
      }
      return { narrative1, narrative2, narrative: [narrative1, narrative2].filter(Boolean).join(' '), angle };
    }
    const parts = narrative.split(/(?<=\.)\s+/);
    if (parts.length >= 2) {
      return { narrative1: parts[0], narrative2: parts.slice(1).join(' '), narrative, angle };
    }
    return { narrative1: narrative, narrative2: null, narrative, angle };
  }

  return { narrative, angle };
}

module.exports = {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts,
  composeEliteArc,
  composeEliteStaffArc,
  composeEliteStaffContactArc,
  composeEliteStaffPitchArc,
  isStaffDirectedQuoteContext,
  visitLabelFromBeat,
  quoteForEliteEmbed,
  formatEliteQuoteEmbed,
  quoteToInsiderLine,
  classifySignals,
  extractQuote,
  extractVisit,
  extractStaffEnergy,
  extractStaffContact,
  extractCoachNames,
  isDbStaffContactBeat,
  extractBoardSignal,
  extractGeographicSignal,
  enrichVisitFromContext
};
