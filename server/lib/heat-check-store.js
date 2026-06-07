const { buildLiveHeatCheck } = require('./heat-check-live');

let _cache = { at: 0, data: null };
const CACHE_MS = parseInt(process.env.HEAT_CHECK_CACHE_MS || '90000', 10);

async function buildHeatCheck(options = {}) {
  const force = !!options.force;
  if (!force && _cache.data && Date.now() - _cache.at < CACHE_MS) {
    return { ..._cache.data, cached: true };
  }
  const data = await buildLiveHeatCheck();
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
