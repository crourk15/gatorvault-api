/**
 * Hard publish gate for recruiting player posts — blocks generic / no-identity copy.
 */
const copy = require('../x-autoposter-copy');
const template = require('../x-autoposter-template');
const validation = require('../x-autoposter-validation');

const GENERIC_PROSPECT_COPY_RE = [
  /the prospect is on uf's board/i,
  /quietly gaining traction here as the staff keeps the relationship active/i,
  /staff is tracking this 20\d{2} target/i,
  /staff is tracking this target/i,
  /florida is quietly gaining traction here/i,
  /face time with the prospect in gainesville/i,
  /campus visit window confirmed — florida had real face time with (?:the prospect|this target)/i,
  /beat intel confirmed uf football context/i,
  /failed first-pass filters/i,
  /beat trail and player profile on recruiting hub/i,
  /board analysis and futurecast breakdown rebuilt from beat signal/i,
  /gatorvault detectives/i,
  /signal verified on a florida recruiting target/i,
  /logged a campus visit window/i,
  /^florida recruiting intel$/im,
  /full rpm, visit intel, and predictions on futurecast/i
];

const YEAR_ONLY_IDENTITY_RE = /^20\d{2}\.?$/;
const YEAR_LEAD_NO_NAME_RE = /^20\d{2}(?:\s+(?:DL|QB|RB|WR|TE|OL|OT|OG|C|EDGE|LB|CB|S|ATH|K|P))?\s*$/i;

function firstLine(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0] || '';
}

function isRecruitingPlayerCandidate(raw) {
  if (!raw) return false;
  if (raw.triggerType === 'program_news' || raw.triggerType === 'team_event') return false;
  if (raw.topic && raw.topic !== 'recruiting') return false;
  const src = String(raw.source || '');
  if (/program-news|team-event|uf-official|heat-pulse|evergreen|article/.test(src)) return false;
  return (
    raw.topic === 'recruiting' ||
    src.includes('detectives') ||
    src.includes('beat-intel') ||
    src.includes('research-ladder') ||
    !!raw.playerSlug ||
    !!raw.playerName ||
    raw.validationMeta?.detectivesResolved ||
    raw.validationMeta?.researchLadder
  );
}

function identityLineValid(identityLine, playerName) {
  const line = String(identityLine || '').trim();
  if (!line || line.length < 8) return false;
  if (YEAR_ONLY_IDENTITY_RE.test(line)) return false;
  if (YEAR_LEAD_NO_NAME_RE.test(line)) return false;
  if (!copy.isValidPlayerName(playerName)) return false;
  const last = String(playerName).trim().split(/\s+/).pop();
  if (!last || !new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line)) {
    return false;
  }
  return true;
}

function hasGenericProspectCopy(text) {
  const t = String(text || '');
  return GENERIC_PROSPECT_COPY_RE.some((re) => re.test(t));
}

function passesPublishGate(raw) {
  if (!raw?.text) return false;
  const text = String(raw.text || '').trim();
  if (!text || !template.hasTemplateStructure(text)) return false;
  if (copy.isBrokenCopy(text, raw)) return false;
  if (hasGenericProspectCopy(text)) return false;
  if (copy.isGenericRecruitingHubUrl(text)) return false;

  const playerName = raw.playerName || raw.templateBlocks?.playerName || null;
  if (!copy.isValidPlayerName(playerName)) return false;
  if (!copy.postReferencesPlayerName(text, playerName)) return false;

  const identity = raw.templateBlocks?.identity || firstLine(text);
  if (!identityLineValid(identity, playerName)) return false;

  if (!/\/player\/|futurecast\/player\//i.test(text)) return false;

  const blocks = raw.templateBlocks || validation.parseTemplateBlocks({ text }) || {};
  const context = String(blocks.context || '').trim();
  const insider = String(blocks.insider || '').trim();
  if (!context || context.length < 28) return false;
  if (!insider || insider.length < 24) return false;
  if (hasGenericProspectCopy(`${context}\n${insider}`)) return false;

  return true;
}

function rejectReason(raw) {
  if (!raw?.text) return 'missing_text';
  if (hasGenericProspectCopy(raw.text)) return 'generic_prospect_copy';
  if (copy.isGenericRecruitingHubUrl(raw.text)) return 'generic_hub_url';
  if (!copy.isValidPlayerName(raw.playerName)) return 'invalid_player_name';
  if (!copy.postReferencesPlayerName(raw.text, raw.playerName)) return 'player_not_in_body';
  const identity = raw.templateBlocks?.identity || firstLine(raw.text);
  if (!identityLineValid(identity, raw.playerName)) return 'invalid_identity_line';
  if (copy.isBrokenCopy(raw.text, raw)) return 'broken_copy';
  return 'recruiting_qa';
}

module.exports = {
  GENERIC_PROSPECT_COPY_RE,
  isRecruitingPlayerCandidate,
  identityLineValid,
  hasGenericProspectCopy,
  passesPublishGate,
  rejectReason
};
