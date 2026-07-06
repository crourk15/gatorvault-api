/**
 * Deterministic program narrative arcs.
 */
const { selectProgramArc } = require('./program-fact-extractor');

function trimQuote(q = '') {
  return String(q || '').replace(/[.!?]+$/, '').trim();
}

function composeFacilityArc(facts = {}) {
  const facility = facts.facility_name || 'the football training complex';
  const upgrade = facts.upgrade_type || 'major facility upgrades';
  const identity = 'Florida Gators — Facility Upgrade';
  const context = facts.official_source
    ? `${facts.official_source} confirmed ${upgrade} at ${facility}.`
    : `Florida is advancing ${upgrade} at ${facility}.`;
  const insider = facts.timeline
    ? `Target window: ${facts.timeline} — keeps UF in the SEC facility race.`
    : 'The project keeps Florida in the SEC facility arms race.';
  return { identity, context, insider, arc: 'facility' };
}

function composeFacilityVisitArc(facts = {}) {
  const facility = facts.facility_name || 'Heavener Football Training Center';
  const identity = 'Florida Gators — Facility Visit Intel';
  const impression = facts.facility_impression || 'left a strong impression on the visit';
  let context;
  if (/best facility stop/i.test(impression)) {
    context = `A prospect tagged ${facility} as the best facility stop he has seen on the SEC circuit.`;
  } else {
    context = `A campus tour through ${facility} ${impression.replace(/^(called|said)\s+/i, '')}.`;
  }
  const quote = trimQuote(facts.facility_quote);
  const insider = quote
    ? `"${quote}" — facility edge matters on the trail.`
    : 'Facility quality keeps showing up in visit feedback around Gainesville.';
  return { identity, context, insider, arc: 'facility_visit' };
}

function composeNilArc(facts = {}) {
  const entity = facts.nil_entity || 'the verified NIL collective';
  const identity = 'Florida Gators — NIL Infrastructure';
  const context = `${entity} outlined a verified NIL structure supporting Florida Gators football athletes.`;
  const insider = facts.official_source
    ? `${facts.official_source} framing keeps the collective aligned with roster operations.`
    : 'Collective infrastructure keeps pace with SEC NIL expectations.';
  return { identity, context, insider, arc: 'nil' };
}

function composeCultureArc(facts = {}) {
  const speaker = facts.program_speaker || 'Florida staff';
  const quote = trimQuote(facts.program_quote);
  const identity = 'Florida Gators — Program Culture';
  const context = quote
    ? `${speaker} said "${quote}" as Florida sharpens its daily standard.`
    : `${speaker} reinforced Florida's competitive culture in meetings this week.`;
  const insider = 'Culture language is landing with players and staff across the building.';
  return { identity, context, insider, arc: 'culture' };
}

function composeGeneralArc(facts = {}, ctx = {}) {
  const beat = String(facts.beatText || '');
  const hinted = String(ctx?.programNewsType || '').toLowerCase();
  if (hinted === 'sec_tv' || /sec network|flex schedule|tv announcement/i.test(beat)) {
    return {
      identity: 'Florida Gators — SEC / TV Announcement',
      context: 'Florida landed a concrete SEC scheduling and TV window update affecting the Gators.',
      insider: 'The broadcast slot keeps UF in the national rotation early in the cycle.',
      arc: 'general'
    };
  }
  if (hinted === 'realignment' || /realignment|sec expansion/i.test(beat)) {
    return {
      identity: 'Florida Gators — Conference Realignment',
      context: 'Conference realignment chatter keeps Florida positioned in the SEC power lane.',
      insider: 'The Gators remain central to how the SEC footprint is evolving.',
      arc: 'general'
    };
  }
  if (hinted === 'branding' || /uniform reveal|branding|alternate uniform/i.test(beat)) {
    return {
      identity: 'Florida Gators — Uniform & Branding',
      context: 'Florida is rolling out a verified uniform and branding reveal for the football program.',
      insider: 'The look keeps the Gators in the national brand conversation.',
      arc: 'general'
    };
  }
  const identity = 'Florida Gators — Program Update';
  const context = facts.official_source
    ? `${facts.official_source} posted a verified Florida football program update.`
    : 'Florida posted a verified program-level football update.';
  const insider = 'Staff and roster impact still being tracked across the building.';
  return { identity, context, insider, arc: 'general' };
}

function composeProgramArc(facts = {}, ctx = {}) {
  const arc = selectProgramArc(facts);
  switch (arc) {
    case 'facility':
      return composeFacilityArc(facts);
    case 'facility_visit':
      return composeFacilityVisitArc(facts);
    case 'nil':
      return composeNilArc(facts);
    case 'culture':
      return composeCultureArc(facts);
    default:
      return composeGeneralArc(facts, ctx);
  }
}

module.exports = {
  composeFacilityArc,
  composeFacilityVisitArc,
  composeNilArc,
  composeCultureArc,
  composeGeneralArc,
  composeProgramArc
};