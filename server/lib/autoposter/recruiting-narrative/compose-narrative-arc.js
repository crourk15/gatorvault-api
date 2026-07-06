/**
 * Deterministic recruiting narrative arcs — trust, contender, relationship, pitch.
 */
const { selectNarrativeArc } = require('./narrative-fact-extractor');

function composeTrustArc(facts = {}) {
  const name = facts.player_name || 'the verified recruit';
  const quote = facts.quote ? ` "${facts.quote}"` : '';
  return {
    identityStatus: 'Recruiting · Trust',
    context: `${name} on Florida:${quote} — the staff's straight talk is resonating in his recruitment, per the verified beat report.`,
    insider: 'Trust and transparency are stacking as real differentiators in how Florida is being evaluated.',
    arc: 'trust'
  };
}

function composeContenderArc(facts = {}) {
  const name = facts.player_name || 'the verified recruit';
  return {
    identityStatus: 'Recruiting · Contender',
    context: `${name} says Florida is cementing itself as a major contender in his recruitment, per the verified beat report.`,
    insider: 'Florida is moving from interest to a legitimate top-tier option in his process.',
    arc: 'contender'
  };
}

function composeRelationshipArc(facts = {}) {
  const name = facts.player_name || 'the verified recruit';
  return {
    identityStatus: 'Recruiting · Relationship',
    context: `${name} highlighted the relationship building with Florida's staff, per the verified beat report.`,
    insider: 'Staff connection and fit are driving momentum beyond surface-level recruiting noise.',
    arc: 'relationship'
  };
}

function composeProgramPitchArc(facts = {}) {
  const name = facts.player_name || 'the verified recruit';
  return {
    identityStatus: 'Recruiting · Program pitch',
    context: `${name} pointed to Florida's program pitch and development path, per the verified beat report.`,
    insider: 'Scheme fit and player development are central to why Florida is staying in the conversation.',
    arc: 'program_pitch'
  };
}

function composeNarrativeArc(facts = {}, ctx = {}) {
  const arc = selectNarrativeArc(facts);
  switch (arc) {
    case 'relationship':
      return composeRelationshipArc(facts);
    case 'program_pitch':
      return composeProgramPitchArc(facts);
    case 'contender':
      return composeContenderArc(facts);
    default:
      return composeTrustArc(facts);
  }
}

module.exports = {
  composeTrustArc,
  composeContenderArc,
  composeRelationshipArc,
  composeProgramPitchArc,
  composeNarrativeArc
};