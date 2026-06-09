/**
 * Ingest Hayes Fawcett OV cancellation intel for Amare Patterson.
 * Usage: node scripts/ingest-patterson-ov-cancel.js
 */
const { ingestManualVisitIntel } = require('../lib/beat-visit-intel-ingest');

const ROW = {
  playerName: 'Amare Patterson',
  playerSlug: 'amare-patterson',
  on3Id: '243198',
  classYear: 2027,
  pos: 'WR',
  eventType: 'visit_cancelled',
  status: 'OV Cancelled · Florida',
  cancelledSchool: 'Florida',
  nextVisitSchool: 'South Carolina',
  detail:
    'Amare Patterson has cancelled his OV to Florida and will now visit South Carolina this weekend.',
  timestamp: new Date().toISOString(),
  articleUrl: null,
  source: 'Hayes Fawcett',
  sourceHandle: 'Hayesfawcett3',
  sourceType: 'manual',
  fingerprint: `visit_cancel_amare-patterson_${new Date().toISOString().slice(0, 10)}_hayes_fawcett`
};

ingestManualVisitIntel(ROW)
  .then((out) => {
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.processed ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
