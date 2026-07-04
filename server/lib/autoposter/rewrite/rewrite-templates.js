/** PR-6 — elite rewrite templates keyed to PR-5 templateId + beat shape. */

const { lastName } = require('../strategy/strategy-sentences');

function compLabel(compSchools = []) {
  if (!compSchools.length) return null;
  if (compSchools.length >= 2) return `${compSchools[0]} and ${compSchools[1]}`;
  return compSchools[0];
}

function pickRewrite(ctx) {
  const ln = ctx.lastName;
  const templateId = ctx.templateId || '';
  const comps = compLabel(ctx.compSchools);
  const beat = String(ctx.beatText || '').toLowerCase();

  if (/swamp|first trip/i.test(beat) && /top of my board|top schools/i.test(beat)) {
    return {
      narrative1: `${ln}'s first trip to The Swamp gave Florida real traction, and he left calling the Gators one of his top schools.`,
      narrative2: `That visit opened a clean lane on his board, and UF is pressing it early.`
    };
  }

  if (/db coaches texting|all three.*db/i.test(beat) && /gainesville|leaderboard|cracked/i.test(beat)) {
    return {
      narrative1: `Florida's DB staff leaned in after ${ln}'s Gainesville visit, and he's responded.`,
      narrative2: `That trip pushed UF onto his early board, and the staff is spending real capital to stay there.`
    };
  }

  if (/spring practice|on campus this spring/i.test(beat) && /top schools/i.test(beat)) {
    return {
      narrative1: `${ln}'s spring practice visit gave Florida a foothold, and he's already calling the Gators one of his top schools.`,
      narrative2: `UF is positioned early in his recruitment.`
    };
  }

  if (/energy from the staff|staff energy|loved the energy/i.test(beat)) {
    return {
      narrative1: `${ln} was on Florida's campus in early March, and staff energy is still driving this recruitment.`,
      narrative2: `He loved the energy he saw from UF's staff, and Florida is pressing that connection early.`
    };
  }

  if (/early march|on campus at florida/i.test(beat)) {
    return {
      narrative1: `${ln} was on Florida's campus in early March, and that trip put UF in his early mix.`,
      narrative2: comps
        ? `Florida is pressing while ${comps} stay in the mix.`
        : `Florida is pressing that connection early.`
    };
  }

  if (templateId === 'visit_staff') {
    return {
      narrative1: `Florida's staff leaned in after ${ln}'s campus visit, and he's responded.`,
      narrative2: `That contact created board movement, and UF is pressing the lane early.`
    };
  }

  if (templateId === 'visit_board') {
    return {
      narrative1: `${ln}'s campus visit shifted momentum toward UF in this cycle.`,
      narrative2: `Florida now has a real lane here, and the staff is pressing that board window.`
    };
  }

  if (templateId === 'visit_only' && comps) {
    return {
      narrative1: `${ln}'s campus visit gave Florida traction against ${comps}.`,
      narrative2: `That trip opened a separation path, and UF is pushing for the next eval window.`
    };
  }

  if (templateId === 'comp_only' && comps) {
    return {
      narrative1: `Florida is gaining traction with ${ln} while ${comps} stay in the mix.`,
      narrative2: `UF needs more campus time before the cycle window tightens.`
    };
  }

  return {
    narrative1: `${ln}'s recent visit gave Florida real traction in this recruitment.`,
    narrative2: `UF has early positioning here, and the staff is pressing that lane.`
  };
}

function pickShortRewrite(ctx) {
  const ln = ctx.lastName;
  const comps = compLabel(ctx.compSchools);
  const beat = String(ctx.beatText || '').toLowerCase();

  if (/swamp|first trip/i.test(beat)) {
    return {
      narrative1: `${ln}'s Swamp trip gave Florida traction, and the Gators landed on his top-school list.`,
      narrative2: `That visit opened a lane on his board, and UF is pressing early.`
    };
  }
  if (/db coaches|gainesville/i.test(beat)) {
    return {
      narrative1: `Florida's DB staff leaned in after ${ln}'s Gainesville visit, and he responded.`,
      narrative2: `UF is on his early board, and the staff is spending capital to stay there.`
    };
  }
  if (/spring practice/i.test(beat)) {
    return {
      narrative1: `${ln}'s spring visit gave Florida a foothold, and the Gators are one of his top schools.`,
      narrative2: `UF is positioned early in his recruitment.`
    };
  }
  if (/march/i.test(beat) && comps) {
    return {
      narrative1: `${ln} was on Florida's campus in March, and that trip put UF in his early mix.`,
      narrative2: `Florida is pressing while ${comps} stay in the mix.`
    };
  }

  return {
    narrative1: `${ln}'s visit gave Florida traction in this cycle.`,
    narrative2: `UF has a lane here, and the staff is pressing it.`
  };
}

function buildRewriteContext(pr5Pack, signal) {
  const player = signal?.player || {};
  const trace = pr5Pack?.strategyTrace || pr5Pack?.trace || {};
  return {
    lastName: lastName(player.name || ''),
    fullName: player.name || '',
    classYear: player.classYear || '',
    position: player.pos || '',
    templateId: trace.templateId || '',
    beatText: pr5Pack?.beatText || signal?.beatText || signal?.event?.description || '',
    compSchools: signal?.metrics?.compSchools || [],
    confidence: trace.confidence || 'medium'
  };
}

module.exports = {
  pickRewrite,
  pickShortRewrite,
  buildRewriteContext,
  compLabel
};
