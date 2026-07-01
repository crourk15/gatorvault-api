/** Portal Math Engine */
function portalValue(player) { return { value: Number(player?.rating || 0) }; }
function portalImpact(unit) { return { unit, netGainLoss: 0 }; }
function portalStrategy() { return { summary: 'UF portal strategy aligns with scheme fit.' }; }
module.exports = { portalValue, portalImpact, portalStrategy };
