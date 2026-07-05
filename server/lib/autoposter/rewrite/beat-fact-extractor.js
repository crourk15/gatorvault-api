/**
 * Beat-fact extraction — visit, staff energy, quotes, RPM before angle/PR-789.
 */

const { resolveValidCompSchools, compLabel } = require('./comp-sourcing');

const QUOTE_RE = /["“]([^"”]+)["”]|['']([^'']+)['']/g;
const MONTH_VISIT_RE =
  /\b(early\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const FOLLOW_UP_RE = /\bsince\s+(june\s+\d{1,2}|july\s+\d{1,2}|[a-z]+\s+\d{1,2})\b/i;

function extractQuote(beatText = '') {
  const beat = String(beatText);
  const quotes = [];
  let m;
  const re = new RegExp(QUOTE_RE.source, 'g');
  while ((m = re.exec(beat)) !== null) {
    const q = (m[1] || m[2] || '').trim();
    if (q.length >= 8) quotes.push(q);
  }
  return quotes[0] || null;
}

function extractVisit(beatText = '') {
  const beat = String(beatText);
  if (!/\b(on campus|visited|visit|trip|swamp|gainesville)\b/i.test(beat)) return null;

  let when = null;
  const month = beat.match(MONTH_VISIT_RE);
  if (month) when = month[0].trim();
  if (/early march/i.test(beat)) when = 'early March';
  if (/spring practice|this spring/i.test(beat)) when = when || 'this spring';
  if (/first visit to gainesville|gainesville visit/i.test(beat)) when = 'his first Gainesville visit';
  else if (/first visit|first trip/i.test(beat)) when = when || (/first trip/i.test(beat) ? 'first trip' : 'first visit');

  const school = /\bflorida|gators|swamp|gainesville\b/i.test(beat) ? 'Florida' : null;
  const type = /\bofficial\b/i.test(beat) && !/unofficial/i.test(beat) ? 'official' : 'unofficial';

  return { when, type, school };
}

function extractStaffEnergy(beatText = '') {
  const beat = String(beatText).toLowerCase();
  return (
    /\benergy from the staff\b/i.test(beat) ||
    /\bstaff energy\b/i.test(beat) ||
    /\bloved the energy\b/i.test(beat) ||
    /\bappreciated the energy\b/i.test(beat) ||
    /\bcoaches texting\b/i.test(beat) ||
    /\bdb coach/i.test(beat)
  );
}

function extractFollowUpSince(beatText = '') {
  const m = String(beatText).match(FOLLOW_UP_RE);
  return m ? m[1] : null;
}

function extractBoardSignal(beatText = '') {
  const beat = String(beatText).toLowerCase();
  return (
    /\btop of my board\b/i.test(beat) ||
    /\btop schools?\b/i.test(beat) ||
    /\bleaderboard\b/i.test(beat) ||
    /\bcracked his\b/i.test(beat) ||
    /\bstrong position\b/i.test(beat)
  );
}

function extractBeatCompBattle(beatText = '') {
  return /\b(battle|separate|against|competing|race|mix)\b/i.test(String(beatText));
}

function classifySignals(facts = {}) {
  const signals = [];
  if (facts.staffEnergy) signals.push('staff_energy');
  if (facts.quote) signals.push('quote_driven');
  if (facts.visit?.when || facts.visit?.school) signals.push('visit');
  if (facts.boardSignal) signals.push('board');
  if (facts.rpmTop?.length) signals.push('competition');
  if (facts.beatCompBattle) signals.push('competition');
  if (facts.followUpSince) signals.push('follow_up');
  return [...new Set(signals)];
}

function selectAngleFromFacts(facts = {}, beatText = '') {
  const signals = facts.signals || classifySignals(facts);
  const beat = String(beatText || facts.beatText || '').toLowerCase();

  if (/swamp|first trip/i.test(beat) && facts.quote && facts.boardSignal) {
    return { angle: 'visit', reason: 'swamp_quote_board', signals };
  }

  if (facts.staffEnergy && (facts.quote || facts.followUpSince)) {
    return { angle: 'staff', reason: 'staff_energy_quote_or_followup', signals };
  }
  if (facts.staffEnergy && facts.visit?.when) {
    return { angle: 'staff', reason: 'staff_energy_visit', signals };
  }
  if (facts.boardSignal && (facts.quote || facts.visit?.when)) {
    return { angle: 'board', reason: 'board_signal', signals };
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
  if (facts.visit?.when) return { angle: 'visit', reason: 'visit_fallback', signals };

  return { angle: 'visit', reason: 'minimal_facts', signals };
}

function extractBeatFacts(beatText = '', ctx = {}) {
  const beat = String(beatText || ctx.beatText || '').trim();
  const signal = ctx.signal || {};
  const metrics = ctx.metrics || signal.metrics || {};
  const player = ctx.player || signal.player || {};
  const intel = ctx.intel || null;

  const compPack = resolveValidCompSchools({
    beatText: beat,
    metrics,
    intel,
    player
  });

  const rpmTop = compPack.rpmTop.length ? compPack.rpmTop : [];

  const facts = {
    visit: extractVisit(beat),
    staffEnergy: extractStaffEnergy(beat),
    followUpSince: extractFollowUpSince(beat),
    quote: extractQuote(beat),
    rpmTop,
    compSchools: compPack.schools,
    offerSchools: (intel?.offers || []).map((o) => o.school).filter(Boolean),
    visitSchools: (intel?.visits || []).map((v) => v.school).filter(Boolean),
    boardSignal: extractBoardSignal(beat),
    beatCompBattle: extractBeatCompBattle(beat),
    provenance: {
      visit: extractVisit(beat) ? 'beat' : null,
      staffEnergy: extractStaffEnergy(beat) ? 'beat' : null,
      quote: extractQuote(beat) ? 'beat' : null,
      rpmTop: rpmTop.length ? (metrics.rpmTop ? 'metrics' : 'intel') : null
    }
  };

  facts.signals = classifySignals(facts);
  facts.beatText = beat;
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
  return String(quote)
    .replace(/["""]+$/, '')
    .replace(/[."]+$/, '')
    .trim()
    .replace(/^I /i, '');
}

function eliteTakeaway(facts, angle) {
  if (angle === 'staff' && facts.staffEnergy) {
    if (facts.quote && /energy/i.test(String(facts.quote))) return 'the staff sell is landing';
    return 'the staff pitch is resonating';
  }
  if (angle === 'board' && facts.boardSignal) return 'UF is on his board early';
  if (angle === 'visit' && facts.visit?.when) return 'the campus connection is real';
  if (facts.rpmTop?.length) return 'Florida is still firmly in the mix';
  return 'UF is clearly still in the mix';
}

function composeEliteStaffArc(facts, ln, opts = {}) {
  const visitWhen = facts.visit?.when === 'his first Gainesville visit' ? 'Gainesville' : facts.visit?.when || 'campus';

  if (opts.eliteShort) {
    let paragraph = `${ln}'s ${visitWhen} UF visit — staff energy drives this`;
    if (facts.quote) {
      const embedded = quoteForEliteEmbed(facts.quote);
      if (embedded) paragraph += `. He said he "${embedded}."`;
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
    const embedded = quoteForEliteEmbed(facts.quote);
    if (embedded) paragraph += ` — he said he "${embedded}."`;
  } else if (facts.staffEnergy) {
    paragraph += ` — and he loved the energy from UF's staff`;
  }

  if (facts.followUpSince) {
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

function composeEliteVisitArc(facts, ln, beatText = '', opts = {}) {
  const beat = String(beatText || '').toLowerCase();
  const swampTrip = /swamp|first trip/i.test(beat);
  let paragraph;

  if (swampTrip) {
    paragraph = `${ln}'s first trip to The Swamp gave Florida early traction`;
  } else {
    const when = facts.visit?.when || 'campus';
    paragraph = `${ln} was on Florida's campus in ${when}, and that trip put UF in his early mix with real traction`;
  }

  if (facts.quote) {
    const embedded = quoteForEliteEmbed(facts.quote);
    if (embedded) paragraph += ` — he said he "${embedded}."`;
  } else if (swampTrip && !facts.quote) {
    paragraph += ` — and he left with the Gators on his board early`;
  }

  if (!facts.quote && facts.boardSignal && !swampTrip) {
    paragraph += ` He's already listing Florida among his top schools.`;
  }

  if (facts.followUpSince) {
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
    paragraph += ` ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix because ${eliteTakeaway(facts, 'visit')}.`;
  } else if (!paragraph.endsWith('.') && !paragraph.endsWith('."')) {
    paragraph += '.';
  }

  return paragraph;
}

function composeEliteBoardArc(facts, ln, opts = {}) {
  let paragraph = `${ln} has Florida in his top-school mix after spring campus time`;

  if (facts.quote) {
    const embedded = quoteForEliteEmbed(facts.quote);
    if (embedded) paragraph += ` — he said he "${embedded}."`;
  } else {
    paragraph += ` — and UF is positioned early with him`;
  }

  if (facts.rpmTop?.length >= 2 && !opts.trimComp) {
    paragraph += `. ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead his RPM board, but UF is clearly in the mix because ${eliteTakeaway(facts, 'board')}.`;
  } else {
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
    case 'staff':
      return composeEliteStaffArc(facts, ln, opts);
    case 'board':
      return composeEliteBoardArc(facts, ln, opts);
    case 'competition':
      return composeEliteCompetitionArc(facts, ln, opts);
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

function composeBoardArc(facts, ln) {
  if (facts.quote && /top schools/i.test(String(facts.quote))) {
    return `${ln} is listing Florida among his top schools after his recent campus time, and UF is positioned early in this cycle.`;
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
    return { narrative, narrative1: narrative, narrative2: null, angle };
  }

  let narrative;

  switch (angle) {
    case 'staff':
      narrative = composeStaffArc(facts, ln, opts, ctx.beatText);
      break;
    case 'board':
      narrative = composeBoardArc(facts, ln);
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
  quoteForEliteEmbed,
  quoteToInsiderLine,
  classifySignals,
  extractQuote,
  extractVisit,
  extractStaffEnergy
};
