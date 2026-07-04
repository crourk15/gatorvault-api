/** Momentum v1 — rank, offers, visits, RPM deltas from observations + current state. */

const MS_DAY = 24 * 60 * 60 * 1000;

function countRecent(items = [], dateField, windowMs) {
  const cutoff = Date.now() - windowMs;
  return items.filter((row) => {
    const t = new Date(row[dateField] || row.date || row.observedAt || row.timestamp).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}

function computeMomentum({ player = {}, offers = [], visits = [], rpm = {}, priorSnapshot = null } = {}) {
  const offerDelta = countRecent(offers, 'observedAt', 14 * MS_DAY);
  const visitDelta = countRecent(visits, 'visitDate', 30 * MS_DAY);

  let rankDelta = null;
  if (priorSnapshot?.rankingBlock?.valid && player?.natlRank != null) {
    const prior = priorSnapshot.rankingBlock.on3NationalRank;
    if (prior != null && Number(player.natlRank) > 0) {
      rankDelta = prior - Number(player.natlRank);
    }
  }

  let rpmDelta = null;
  if (priorSnapshot?.rpm?.ufPct != null && rpm?.ufPct != null) {
    rpmDelta = Math.round((Number(rpm.ufPct) - Number(priorSnapshot.rpm.ufPct)) * 10) / 10;
  }

  return {
    rankDelta,
    offerDelta,
    visitDelta,
    rpmDelta,
    engagementScore: null,
    computedAt: new Date().toISOString()
  };
}

module.exports = { computeMomentum };
