'use strict';

function gatorsLivePhase(input) {
  if (input.mode === 'ready') return 'ready';
  const status = String(input.status || '');
  if (input.completed === true || /\bfinal\b/i.test(status)) return 'final';
  if (/halftime/i.test(status)) return 'halftime';
  if (input.live === true || /in progress|\blive\b/i.test(status)) return 'live';
  return 'pregame';
}

function gatorsLiveVoice(phase, opp) {
  const who = String(opp || 'the opponent').trim() || 'the opponent';
  if (phase === 'live') return `Florida is on the field vs ${who}. Talk every snap.`;
  if (phase === 'halftime') return `Halftime vs ${who}. What is working. What is not.`;
  if (phase === 'final') return `Final vs ${who}. Stay for the after. What did you see?`;
  if (phase === 'pregame') return `The window is open vs ${who}. Talk now, then through kickoff.`;
  return `Next: Florida vs ${who}. The room stays open all week.`;
}

function possessionSide(possession) {
  const raw = String(possession || '').trim();
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (p === '57' || p === 'fla' || p === 'uf') return 'uf';
  if (p.includes('florida') && !p.includes('atlantic') && !p.includes('state')) return 'uf';
  return 'opp';
}

function periodClockLabel(opts) {
  if (opts.phase === 'final') return 'Final';
  if (opts.phase === 'halftime') return 'Halftime';
  const clock = String(opts.clock || '').trim();
  const period = opts.period;
  if (period != null && Number.isFinite(period)) {
    const q =
      period === 1 ? '1st' : period === 2 ? '2nd' : period === 3 ? '3rd' : period === 4 ? '4th' : `OT${period - 4 || ''}`;
    return clock ? `${q} · ${clock}` : `${q} quarter`;
  }
  const status = String(opts.status || '').trim();
  if (status) return status;
  if (opts.phase === 'pregame') return 'Scheduled';
  return 'Game window';
}

function pickCommunityTalkThread(threads) {
  if (!threads.length) return null;
  const gameday = threads.find((t) => t.gameday || /game day talk/i.test(t.title || ''));
  if (gameday) return gameday;
  const daily = threads.find((t) => Boolean(t.dailyKey));
  if (daily) return daily;
  return threads.find((t) => t.pinned || t.featured) || threads[0] || null;
}

module.exports = {
  gatorsLivePhase,
  gatorsLiveVoice,
  possessionSide,
  periodClockLabel,
  pickCommunityTalkThread,
};
