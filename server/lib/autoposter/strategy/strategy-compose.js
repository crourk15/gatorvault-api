/** PR-5 — deterministic strategy templates by signal combo. */

const { bestSignal, hasSignalType } = require('./strategy-metrics');
const { containsBannedPhrase } = require('./strategy-provenance');
const { BANNED_STRATEGY_PHRASES, MIN_STRATEGY_CHARS } = require('./strategy-types');

function tokenOf(signals, type) {
  const sig = bestSignal(signals, type);
  return sig?.tokens?.[0] || null;
}

function compPhrase(signals) {
  const sig = bestSignal(signals, 'comp');
  if (!sig?.tokens?.length) return null;
  if (sig.tokens.length >= 2) return `${sig.tokens[0]} and ${sig.tokens[1]}`;
  return sig.tokens[0];
}

const TEMPLATES = {
  visit_board: (s) => {
    const visit = tokenOf(s, 'visit');
    const board = tokenOf(s, 'board');
    if (/swamp|first trip/i.test(String(visit))) {
      return `${visit} plus ${board} — Swamp time is doing real board work for UF here.`;
    }
    if (/leaderboard|cracked/i.test(String(board))) {
      return `${visit} moved him enough to ${board} — UF earned board lift, not just a mention.`;
    }
    if (/spring|top schools/i.test(`${visit} ${board}`)) {
      return `${visit} synced with ${board} — spring activity is pushing UF up his pecking order.`;
    }
    return `${visit} and ${board} showing together — UF has tangible board traction now.`;
  },
  visit_staff: (s) => {
    const visit = tokenOf(s, 'visit');
    const staff = tokenOf(s, 'staff');
    return `${staff} plus ${visit} — that is actionable staff capital, not a courtesy check-in.`;
  },
  board_staff: (s) => {
    const board = tokenOf(s, 'board');
    const staff = tokenOf(s, 'staff');
    return `${board} backed by ${staff} — UF is spending reps here before the next eval cut.`;
  },
  comp_ufAngle: (s) => {
    const comp = compPhrase(s);
    const angle = tokenOf(s, 'ufAngle');
    if (comp && angle) {
      return `${angle} with ${comp} still involved — UF's lane opens if the visit window converts.`;
    }
    return null;
  },
  visit_ufAngle: (s) => {
    const visit = tokenOf(s, 'visit');
    const angle = tokenOf(s, 'ufAngle');
    if (!visit || !angle) return null;
    return `${angle} — ${visit} is where UF proves that without leaning on offer leverage.`;
  },
  visit_only: (s) => {
    const visit = tokenOf(s, 'visit');
    const comp = compPhrase(s);
    if (comp) {
      return `${visit} is UF's separation play against ${comp} — face time before the next cut.`;
    }
    return `${visit} is the live UF signal — board talk means less without that campus proof.`;
  },
  board_only: (s) => {
    const board = tokenOf(s, 'board');
    return `${board} keeps UF in an active lane — the next visit window decides momentum.`;
  },
  staff_only: (s) => {
    const staff = tokenOf(s, 'staff');
    return `${staff} — UF is front-loading relationship work instead of waiting on offer math.`;
  },
  comp_only: (s) => {
    const comp = compPhrase(s);
    return `${comp} in the mix — UF wins by stacking campus time before the next eval cycle.`;
  },
  ufAngle_only: (s) => {
    const angle = tokenOf(s, 'ufAngle');
    return `${angle} — that is the differentiator UF can lean on in the next contact window.`;
  },
  quote_visit: (s) => {
    const quote = tokenOf(s, 'quote');
    const visit = tokenOf(s, 'visit');
    if (!quote || !visit) return null;
    const shortQuote = quote.length > 36 ? `${quote.slice(0, 33)}…` : quote;
    return `"${shortQuote}" — ${visit} is when UF can turn words into board movement.`;
  }
};

function templateAvailable(id, signals) {
  switch (id) {
    case 'visit_board':
      return hasSignalType(signals, 'visit') && hasSignalType(signals, 'board');
    case 'visit_staff':
      return hasSignalType(signals, 'visit') && hasSignalType(signals, 'staff');
    case 'board_staff':
      return hasSignalType(signals, 'board') && hasSignalType(signals, 'staff');
    case 'comp_ufAngle':
      return hasSignalType(signals, 'comp') && hasSignalType(signals, 'ufAngle');
    case 'visit_ufAngle':
      return hasSignalType(signals, 'visit') && hasSignalType(signals, 'ufAngle');
    case 'visit_only':
      return hasSignalType(signals, 'visit');
    case 'board_only':
      return hasSignalType(signals, 'board');
    case 'staff_only':
      return hasSignalType(signals, 'staff');
    case 'comp_only':
      return hasSignalType(signals, 'comp');
    case 'ufAngle_only':
      return hasSignalType(signals, 'ufAngle');
    case 'quote_visit':
      return hasSignalType(signals, 'quote') && hasSignalType(signals, 'visit');
    default:
      return false;
  }
}

function resolveTemplateOrder(signals) {
  const { TEMPLATE_PRIORITY } = require('./strategy-types');
  const staff = bestSignal(signals, 'staff');
  if (staff?.confidence === 'high' && hasSignalType(signals, 'visit')) {
    return [
      'visit_staff',
      'board_staff',
      'visit_board',
      ...TEMPLATE_PRIORITY.filter((id) => !['visit_staff', 'board_staff', 'visit_board'].includes(id))
    ];
  }
  return TEMPLATE_PRIORITY;
}

function composeStrategy(signals, identity = {}) {
  for (const templateId of resolveTemplateOrder(signals)) {
    if (!templateAvailable(templateId, signals)) continue;
    const fn = TEMPLATES[templateId];
    const line = fn(signals);
    if (!line || line.length < MIN_STRATEGY_CHARS) continue;
    if (containsBannedPhrase(line, BANNED_STRATEGY_PHRASES)) continue;

    return {
      strategyLine: line,
      templateId,
      chosenSignals: signals.filter((sig) => {
        if (templateId === 'visit_board') return sig.type === 'visit' || sig.type === 'board';
        if (templateId === 'visit_staff') return sig.type === 'visit' || sig.type === 'staff';
        if (templateId === 'board_staff') return sig.type === 'board' || sig.type === 'staff';
        if (templateId === 'comp_ufAngle') return sig.type === 'comp' || sig.type === 'ufAngle';
        if (templateId === 'visit_ufAngle') return sig.type === 'visit' || sig.type === 'ufAngle';
        if (templateId === 'quote_visit') return sig.type === 'quote' || sig.type === 'visit';
        return sig.type === templateId.replace('_only', '');
      })
    };
  }

  return { strategyLine: null, templateId: null, chosenSignals: [] };
}

module.exports = {
  composeStrategy,
  templateAvailable,
  TEMPLATES
};
