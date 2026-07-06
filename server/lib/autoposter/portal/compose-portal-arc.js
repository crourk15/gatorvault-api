/**
 * Deterministic portal narrative arcs — portal_in, portal_out, portal_landing.
 */
const { selectPortalArc } = require('./portal-fact-extractor');

function composePortalInArc(facts = {}) {
  const name = facts.player_name || 'the verified portal name';
  const school = facts.former_school ? ` from ${facts.former_school}` : '';
  return {
    identityStatus: 'Portal · UF target',
    context: `${name}${school} entered the transfer portal — Florida is among the programs tracking, per the verified beat report.`,
    insider: 'Portal fit and roster need still being mapped across the staff room.',
    arc: 'portal_in'
  };
}

function composePortalOutArc(facts = {}) {
  const name = facts.player_name || 'the verified portal name';
  return {
    identityStatus: 'Portal · UF exit',
    context: `${name} entered the transfer portal from the Florida roster, per the verified beat report.`,
    insider: 'Roster depth and scheme fit will shift as the staff recalibrates the room.',
    arc: 'portal_out'
  };
}

function composePortalLandingArc(facts = {}) {
  const name = facts.player_name || 'the verified portal name';
  const school = facts.former_school ? ` from ${facts.former_school}` : '';
  return {
    identityStatus: 'Portal · Florida',
    context: `${name}${school} is transferring to Florida via the portal, per the verified beat report.`,
    insider: 'The addition reshapes how Florida stacks skill and experience in the portal window.',
    arc: 'portal_landing'
  };
}

function composePortalArc(facts = {}, ctx = {}) {
  const arc = selectPortalArc(facts);
  switch (arc) {
    case 'portal_out':
      return composePortalOutArc(facts);
    case 'portal_landing':
      return composePortalLandingArc(facts);
    default:
      return composePortalInArc(facts);
  }
}

module.exports = {
  composePortalInArc,
  composePortalOutArc,
  composePortalLandingArc,
  composePortalArc
};