/**
 * Program beat fact extraction — facility, NIL, culture, visits.
 */
const { resolveNilEntity } = require('./nil-entity-allowlist');

const FACILITY_NAME_RE =
  /\b(Heavener(?:\s+Football\s+Training\s+Center)?|Ben Hill Griffin Stadium|The Swamp|James G. Heavener Jr\.?\s+Football Training Center)\b/i;
const OFFICIAL_SOURCE_RE =
  /\b(UF athletics|Florida athletics|Florida Gators athletics|athletic department|officially announced|per UF athletics)\b/i;
const UPGRADE_RE =
  /\b(upgrade(?:d|s)?|renovation|renovate|expansion|expanded|capital project|\$[\d,.]+\s*(?:b(?:illion)?|m(?:illion)?))\b/i;
const TIMELINE_RE =
  /\b(?:by|in|for|slated for|targeting|opens in)\s+(20\d{2}|this spring|next spring|fall 20\d{2}|spring 20\d{2})\b/i;
const SPEAKER_RE =
  /\b(Brent Sumrall|Billy Napier|Jay Bateman|Marques Elam|Tim Skipper|Austin Peay)\b/i;

function normalizeBeat(beatText = '') {
  return String(beatText || '').replace(/\s+/g, ' ').trim();
}

function extractProgramQuote(beatText = '') {
  const beat = String(beatText || '');
  const dbl = beat.match(/["\u201c]([^\"\u201d]{8,220})["\u201d]/);
  if (dbl) return dbl[1].trim();
  const sgl = beat.match(/(?:^|[\s([{>])'([^']{8,220})'(?:[\s)\]}>.,!?;]|$)/);
  if (sgl) return sgl[1].trim();
  return null;
}

function inferUpgradeType(beatText = '') {
  const beat = String(beatText || '');
  if (/weight room|recovery space|performance space|locker room/i.test(beat)) {
    return 'expanded performance and recovery space';
  }
  if (/renovation|renovate/i.test(beat)) return 'major renovation work';
  if (UPGRADE_RE.test(beat)) return 'major facility upgrades';
  return null;
}

function inferProgramType(facts = {}) {
  if (facts.nil_entity) return 'nil';
  if (facts.program_quote && facts.program_speaker) return 'culture';
  if (facts.facility_visit && (facts.facility_impression || facts.facility_quote)) return 'facility_visit';
  if (facts.facility_name || facts.upgrade_type) return 'facility';
  return 'general';
}

function extractProgramFacts(beatText = '', ctx = {}) {
  const beat = normalizeBeat(beatText);
  const facts = {
    beatText: beat,
    program_type: null,
    official_source: null,
    facility_name: null,
    upgrade_type: null,
    nil_entity: null,
    program_quote: null,
    program_speaker: null,
    timeline: null,
    facility_visit: false,
    facility_impression: null,
    facility_quote: null
  };

  if (!beat) return facts;

  const facilityMatch = beat.match(FACILITY_NAME_RE);
  if (facilityMatch) {
    facts.facility_name = /heavener/i.test(facilityMatch[1])
      ? 'Heavener Football Training Center'
      : facilityMatch[1].replace(/\bthe\b/i, 'The');
  }

  if (OFFICIAL_SOURCE_RE.test(beat)) facts.official_source = 'UF athletics';

  facts.upgrade_type = inferUpgradeType(beat);

  const nil = resolveNilEntity(beat);
  if (nil?.name) facts.nil_entity = nil.name;

  const speaker = beat.match(SPEAKER_RE);
  if (speaker) facts.program_speaker = speaker[1];
  facts.program_quote = extractProgramQuote(beat);

  const timeline = beat.match(TIMELINE_RE);
  if (timeline) facts.timeline = timeline[1];

  facts.facility_visit =
    /\b(visit|tour(?:ed|s)?|visited|walk(?:ed|ing) through|facility visit|tour stop)\b/i.test(beat) &&
    Boolean(facts.facility_name || /heavener|training center|facility/i.test(beat));

  const impression = beat.match(
    /\b(best (?:facility )?(?:stop|visit) (?:he|they|'ve|I) (?:have )?(?:seen|had)|best facility stop|left (?:a )?(?:clear|strong|major) impression|blown away)\b/i
  );
  if (impression) facts.facility_impression = impression[0];
  else if (/best facility stop/i.test(beat)) facts.facility_impression = 'best facility stop on the visit circuit';

  if (facts.program_quote && facts.facility_visit) facts.facility_quote = facts.program_quote;

  facts.program_type = inferProgramType(facts);
  if (ctx.programNewsType && facts.program_type === 'general') {
    facts.program_type = String(ctx.programNewsType).includes('nil')
      ? 'nil'
      : String(ctx.programNewsType).includes('facility')
        ? 'facility'
        : facts.program_type;
  }

  return facts;
}

function selectProgramArc(facts = {}) {
  const type = facts.program_type || 'general';
  if (type === 'nil') return 'nil';
  if (type === 'culture') return 'culture';
  if (type === 'facility_visit') return 'facility_visit';
  if (type === 'facility') return 'facility';
  return 'general';
}

module.exports = {
  extractProgramFacts,
  selectProgramArc,
  normalizeBeat,
  extractProgramQuote
};