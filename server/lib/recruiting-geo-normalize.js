/**
 * Lightweight hometown / state normalization for recruiting hub footprint.
 * No external geocoding — canonical state codes + state centroids only.
 */
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

const STATE_CENTROIDS = {
  AL: { lat: 32.806671, lng: -86.79113 },
  AK: { lat: 61.370716, lng: -152.404419 },
  AZ: { lat: 33.729759, lng: -111.431221 },
  AR: { lat: 34.969704, lng: -92.373123 },
  CA: { lat: 36.116203, lng: -119.681564 },
  CO: { lat: 39.059811, lng: -105.311104 },
  CT: { lat: 41.597782, lng: -72.755371 },
  DE: { lat: 39.318523, lng: -75.507141 },
  FL: { lat: 27.766279, lng: -81.686783 },
  GA: { lat: 33.040619, lng: -83.643074 },
  HI: { lat: 21.094318, lng: -157.498337 },
  ID: { lat: 44.240459, lng: -114.478828 },
  IL: { lat: 40.349457, lng: -88.986137 },
  IN: { lat: 39.849426, lng: -86.258278 },
  IA: { lat: 42.011539, lng: -93.210526 },
  KS: { lat: 38.5266, lng: -96.726486 },
  KY: { lat: 37.66814, lng: -84.670067 },
  LA: { lat: 31.169546, lng: -91.867805 },
  ME: { lat: 44.693947, lng: -69.381927 },
  MD: { lat: 39.063946, lng: -76.802101 },
  MA: { lat: 42.230171, lng: -71.530106 },
  MI: { lat: 43.326618, lng: -84.536095 },
  MN: { lat: 45.694454, lng: -93.900192 },
  MS: { lat: 32.741646, lng: -89.678696 },
  MO: { lat: 38.456085, lng: -92.288368 },
  MT: { lat: 46.921925, lng: -110.454353 },
  NE: { lat: 41.12537, lng: -98.268082 },
  NV: { lat: 38.313515, lng: -117.055374 },
  NH: { lat: 43.452492, lng: -71.563896 },
  NJ: { lat: 40.298904, lng: -74.521011 },
  NM: { lat: 34.840515, lng: -106.248482 },
  NY: { lat: 42.165726, lng: -74.948051 },
  NC: { lat: 35.630066, lng: -79.806419 },
  ND: { lat: 47.528912, lng: -99.784012 },
  OH: { lat: 40.388783, lng: -82.764915 },
  OK: { lat: 35.565342, lng: -96.928917 },
  OR: { lat: 44.572021, lng: -122.070938 },
  PA: { lat: 40.590752, lng: -77.209755 },
  RI: { lat: 41.680893, lng: -71.51178 },
  SC: { lat: 33.856892, lng: -80.945007 },
  SD: { lat: 44.299782, lng: -99.438828 },
  TN: { lat: 35.747845, lng: -86.692345 },
  TX: { lat: 31.054487, lng: -97.563461 },
  UT: { lat: 40.150032, lng: -111.862434 },
  VT: { lat: 44.045876, lng: -72.710686 },
  VA: { lat: 37.769337, lng: -78.169968 },
  WA: { lat: 47.400902, lng: -121.490494 },
  WV: { lat: 38.491226, lng: -80.954453 },
  WI: { lat: 44.268543, lng: -89.616508 },
  WY: { lat: 42.755966, lng: -107.30249 },
  DC: { lat: 38.897438, lng: -77.026817 },
};

const STATE_FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20',
  KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28',
  MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36',
  NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45',
  SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56', DC: '11',
};

const normalizeStateNameVariants = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
  michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'washington dc': 'DC', 'washington d.c.': 'DC',
  fla: 'FL', 'fla.': 'FL', calif: 'CA', 'calif.': 'CA', tex: 'TX', penn: 'PA', 'penn.': 'PA',
  mass: 'MA', 'mass.': 'MA', mich: 'MI', 'mich.': 'MI', conn: 'CT', 'conn.': 'CT',
};

function normalizeStateCode(input) {
  if (input == null || input === '') return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper.length === 2 && US_STATE_CODES.has(upper)) return upper;

  const lower = raw.toLowerCase().replace(/\./g, '');
  if (normalizeStateNameVariants[lower]) return normalizeStateNameVariants[lower];
  if (normalizeStateNameVariants[raw.toLowerCase()]) return normalizeStateNameVariants[raw.toLowerCase()];

  const cityState = raw.match(/,\s*([A-Za-z.]{2,})\s*$/);
  if (cityState) {
    const fromTail = normalizeStateCode(cityState[1]);
    if (fromTail) return fromTail;
  }

  return null;
}

function parseHometown(raw) {
  if (raw == null || raw === '') return { hometownCity: null, hometownState: null };
  const text = String(raw).trim();
  if (!text) return { hometownCity: null, hometownState: null };

  const cityStateMatch = text.match(/^(.+?),\s*([A-Za-z.\s]{2,})$/);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    const state = normalizeStateCode(cityStateMatch[2].trim());
    if (state) return { hometownCity: city || null, hometownState: state };
  }

  const embedded = text.match(/([A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  if (embedded) {
    return {
      hometownCity: embedded[1].trim() || null,
      hometownState: normalizeStateCode(embedded[2]),
    };
  }

  const loneState = normalizeStateCode(text);
  if (loneState && text.length <= 20) {
    return { hometownCity: null, hometownState: loneState };
  }

  return { hometownCity: null, hometownState: null };
}

function resolvePlayerState(player) {
  const direct =
    player?.hometownState ||
    player?.hometown_state ||
    player?.state ||
    null;
  const fromDirect = normalizeStateCode(direct);
  if (fromDirect) return fromDirect;

  for (const field of [player?.school, player?.skinny, player?.scoutingReport, player?.evaluationSummary]) {
    const parsed = parseHometown(field);
    if (parsed.hometownState) return parsed.hometownState;
  }

  return null;
}

function normalizePlayerGeo(player) {
  if (!player) return {};

  let hometownCity =
    player.hometownCity ||
    player.hometown_city ||
    null;
  let hometownState =
    normalizeStateCode(player.hometownState || player.hometown_state || player.state) ||
    null;

  if (!hometownState || !hometownCity) {
    for (const field of [player.school, player.skinny, player.scoutingReport, player.evaluationSummary]) {
      const parsed = parseHometown(field);
      if (!hometownCity && parsed.hometownCity) hometownCity = parsed.hometownCity;
      if (!hometownState && parsed.hometownState) hometownState = parsed.hometownState;
      if (hometownCity && hometownState) break;
    }
  }

  if (!hometownState) {
    hometownState = resolvePlayerState(player);
  }

  const patch = {};
  if (hometownCity) patch.hometownCity = hometownCity;
  if (hometownState) {
    patch.hometownState = hometownState;
    patch.state = hometownState;
    patch.stateFips = STATE_FIPS[hometownState] || null;
    const centroid = STATE_CENTROIDS[hometownState];
    if (centroid) {
      if (player.pinLat == null && player.lat == null) patch.pinLat = centroid.lat;
      if (player.pinLng == null && player.lng == null) patch.pinLng = centroid.lng;
    }
  }

  return patch;
}

module.exports = {
  US_STATE_CODES,
  STATE_CENTROIDS,
  STATE_FIPS,
  normalizeStateNameVariants,
  normalizeStateCode,
  parseHometown,
  resolvePlayerState,
  normalizePlayerGeo,
};
