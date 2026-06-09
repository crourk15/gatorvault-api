/**
 * Member feedback — suggestion box + survey responses (local JSON store).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data', 'feedback');
const SUGGESTIONS_PATH = path.join(DATA_DIR, 'suggestions.json');
const SURVEYS_PATH = path.join(DATA_DIR, 'surveys.json');
const SUBMISSIONS_PATH = path.join(DATA_DIR, 'submissions.json');

const FEEDBACK_CATEGORIES = [
  'General',
  'Bug',
  'Feature Request',
  'Film Room',
  'Recruiting',
  'Live Feed',
  'Account / Billing',
  'Other'
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function addSuggestion({ email, name, message, tier, page }) {
  const text = String(message || '').trim();
  if (text.length < 10) throw new Error('Suggestion must be at least 10 characters');
  const doc = readJson(SUGGESTIONS_PATH, { items: [] });
  const row = {
    id: newId('sug'),
    email: String(email || '').trim() || null,
    name: String(name || '').trim() || null,
    message: text.slice(0, 2000),
    tier: tier || null,
    page: page || null,
    createdAt: new Date().toISOString()
  };
  doc.items = doc.items || [];
  doc.items.unshift(row);
  writeJson(SUGGESTIONS_PATH, doc);
  return row;
}

function addSurveyResponse({ email, tier, answers }) {
  if (!answers || typeof answers !== 'object') throw new Error('Survey answers required');
  const doc = readJson(SURVEYS_PATH, { items: [] });
  const row = {
    id: newId('sur'),
    email: String(email || '').trim() || null,
    tier: tier || null,
    answers,
    createdAt: new Date().toISOString()
  };
  doc.items = doc.items || [];
  doc.items.unshift(row);
  writeJson(SURVEYS_PATH, doc);
  return row;
}

function listSuggestions({ limit = 50 } = {}) {
  const doc = readJson(SUGGESTIONS_PATH, { items: [] });
  return (doc.items || []).slice(0, limit);
}

function listSurveys({ limit = 50 } = {}) {
  const doc = readJson(SURVEYS_PATH, { items: [] });
  return (doc.items || []).slice(0, limit);
}

function addSubmission({ rating, category, message, email, page, tier }) {
  const text = String(message || '').trim();
  const stars = parseInt(rating, 10);
  if (!stars || stars < 1 || stars > 5) throw new Error('Rating must be 1–5');
  if (text.length < 5) throw new Error('Message must be at least 5 characters');
  const cat = String(category || 'General').trim();
  const doc = readJson(SUBMISSIONS_PATH, { items: [] });
  const row = {
    id: newId('fb'),
    rating: stars,
    category: FEEDBACK_CATEGORIES.includes(cat) ? cat : 'General',
    message: text.slice(0, 2000),
    email: String(email || '').trim() || null,
    page: page || null,
    tier: tier || null,
    createdAt: new Date().toISOString()
  };
  doc.items = doc.items || [];
  doc.items.unshift(row);
  writeJson(SUBMISSIONS_PATH, doc);
  return row;
}

function listSubmissions({ limit = 100 } = {}) {
  const doc = readJson(SUBMISSIONS_PATH, { items: [] });
  return (doc.items || []).slice(0, limit);
}

module.exports = {
  addSuggestion,
  addSurveyResponse,
  addSubmission,
  listSuggestions,
  listSurveys,
  listSubmissions,
  FEEDBACK_CATEGORIES,
  DATA_DIR
};
