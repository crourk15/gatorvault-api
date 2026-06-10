const { buildLiveHeatCheck } = require('./heat-check-live');

let _cache = { at: 0, data: null };
const CACHE_MS = parseInt(process.env.HEAT_CHECK_CACHE_MS || '90000', 10);

async function buildHeatCheck(options = {}) {
  const force = !!options.force;
  if (!force && _cache.data && Date.now() - _cache.at < CACHE_MS) {
    return { ..._cache.data, cached: true };
  }
  const gm2 = require('./gm2');
  const { GM2_FEATURES } = require('./gm2/types');
  const data = await buildLiveHeatCheck();
  const pgv = gm2.validateBeforeRender(GM2_FEATURES.HEAT_CHECK, data);
  if (!pgv.pass) {
    if (_cache.data) return { ..._cache.data, cached: true, gm2Blocked: pgv.reason };
    data.rising = gm2.filterHeatCheckRising(data.rising || []);
  } else {
    data.rising = gm2.filterHeatCheckRising(data.rising || [], data.intelRows || []);
  }
  _cache = { at: Date.now(), data };
  return data;
}

function clearHeatCheckCache() {
  _cache = { at: 0, data: null };
}

module.exports = {
  buildHeatCheck,
  clearHeatCheckCache
};
