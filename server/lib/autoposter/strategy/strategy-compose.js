/** PR-5 — deterministic strategy templates as complete sentences. */

const { bestSignal, hasSignalType } = require('./strategy-metrics');
const { containsBannedPhrase } = require('./strategy-provenance');
const { BANNED_STRATEGY_PHRASES, MIN_STRATEGY_CHARS } = require('./strategy-types');
const {
  ensurePeriod,
  isCompleteSentence,
  lastName,
  visitPhrase,
  boardPhrase,
  staffPhrase
} = require('./strategy-sentences');

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

function buildTemplates(identity = {}) {
  const name = identity.playerName || identity.name || 'This prospect';
  const ln = lastName(name);

  return {
    visit_board: (s) => {
      const visit = tokenOf(s, 'visit');
      const board = tokenOf(s, 'board');
      if (/swamp|first trip/i.test(String(visit))) {
        return `That Swamp trip gives Florida a live lane on ${ln}'s board.`;
      }
      if (/leaderboard|cracked/i.test(String(board))) {
        return `That Gainesville visit moved ${ln} onto his early leaderboard with Florida.`;
      }
      if (/spring|top schools/i.test(`${visit} ${board}`)) {
        return `Florida is in a strong early spot with ${ln}.`;
      }
      return `Florida gained board traction with ${ln} after a campus visit and a strong board signal.`;
    },
    visit_staff: (s) => {
      const staff = tokenOf(s, 'staff');
      if (/db coaches|coaches texting/i.test(String(staff))) {
        return `UF is spending staff capital early after the visit landed.`;
      }
      return `Florida's staff contact picked up after the visit, and UF has real early leverage.`;
    },
    board_staff: (s) => {
      return `${ln} has Florida on his board while staff contact keeps building for the Gators.`;
    },
    comp_ufAngle: (s) => {
      const comp = compPhrase(s);
      if (!comp) return null;
      return `Florida separated on fit with ${ln} while ${comp} stay in the mix.`;
    },
    visit_ufAngle: (s) => {
      return `${ln} said Florida's interest was clear before he even needed an offer.`;
    },
    visit_only: (s) => {
      const comp = compPhrase(s);
      if (comp) {
        return `${ln}'s campus visit keeps Florida in the mix while ${comp} stay on his board.`;
      }
      return `That campus visit keeps Florida in the picture with ${ln}.`;
    },
    board_only: (s) => {
      return `${ln} ${boardPhrase(tokenOf(s, 'board'))}, and Florida needs the next visit to keep climbing.`;
    },
    staff_only: (s) => {
      return `${staffPhrase(tokenOf(s, 'staff'))}, and Florida is building early leverage with ${ln}.`;
    },
    comp_only: (s) => {
      const comp = compPhrase(s);
      return `Florida needs more campus time with ${ln} before ${comp} pull ahead.`;
    },
    cycle_only: (s) => {
      return `Florida remains in the decision window with ${ln}, and the board math still matters.`;
    },
    ufAngle_only: (s) => {
      return `Florida separated on fit with ${ln}, and that angle matters more than offer timing now.`;
    },
    quote_visit: (s) => {
      const quote = tokenOf(s, 'quote');
      if (!quote) return null;
      const shortQuote = quote.length > 36 ? `${quote.slice(0, 33)}…` : quote;
      return `${ln} said "${shortQuote}" and remains open to another Gainesville trip.`;
    }
  };
}

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
    case 'cycle_only':
      return hasSignalType(signals, 'cycle');
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
  if (hasSignalType(signals, 'ufAngle') && hasSignalType(signals, 'visit')) {
    return [
      'visit_ufAngle',
      'comp_ufAngle',
      ...TEMPLATE_PRIORITY.filter((id) => !['visit_ufAngle', 'comp_ufAngle'].includes(id))
    ];
  }
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
  const TEMPLATES = buildTemplates(identity);

  for (const templateId of resolveTemplateOrder(signals)) {
    if (!templateAvailable(templateId, signals)) continue;
    const fn = TEMPLATES[templateId];
    let line = ensurePeriod(fn(signals));
    if (!line || line.length < MIN_STRATEGY_CHARS) continue;
    if (containsBannedPhrase(line, BANNED_STRATEGY_PHRASES)) continue;
    if (!isCompleteSentence(line)) continue;

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
  buildTemplates
};
