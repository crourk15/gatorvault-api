/** Editorial header rewrite — LLM + fallback. Never expose internal scaffold labels. */
const { isLlmAllowed } = require('./insider-articles-config');
const { isRecruitingBattleArticleType } = require('./insider-articles-types');

const fallbackEditorialHeaders = {
  thesis: 'The Big Picture',
  insiderAngles: 'Inside the Building',
  scheme: 'Scheme Implications',
  roster: 'Roster Movement',
  recruiting: 'Recruiting Battles',
  analytics: 'The Numbers',
  whatsNext: 'What Comes Next',
};

const editorialHeaderPrompts = {
  thesis: 'Rewrite this section header into a natural, premium editorial headline that introduces the article core thesis.',
  insiderAngles: 'Rewrite this section header into a natural editorial headline that conveys insider intel, staff perspective, or behind-the-scenes insight.',
  scheme: 'Rewrite this section header into a natural editorial headline that introduces scheme implications or tactical analysis.',
  roster: 'Rewrite this section header into a natural editorial headline that explains roster movement, depth chart changes, or portal impact.',
  recruiting: 'Rewrite this section header into a natural editorial headline that introduces recruiting battles, commit likelihoods, or board movement.',
  analytics: 'Rewrite this section header into a natural editorial headline that introduces analytics, data trends, or model insights.',
  whatsNext: 'Rewrite this section header into a natural editorial headline that introduces forward-looking implications or next steps.',
};

function llmModel() {
  return process.env.INSIDER_ARTICLE_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

async function generateHeader(prompt) {
  if (!isLlmAllowed()) return null;
  const apiKey = process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0.5,
      max_tokens: 24,
      messages: [
        { role: 'system', content: 'Return only a short section headline, no quotes.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error('LLM header failed (' + res.status + ')');
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return text ? String(text).replace(/^["']|["']$/g, '').trim().slice(0, 120) : null;
}

function dynamicFallbackHeaders({ articleType, season, portalCount } = {}) {
  const yr = season || new Date().getFullYear();
  return {
    thesis: fallbackEditorialHeaders.thesis,
    insiderAngles: fallbackEditorialHeaders.insiderAngles,
    scheme: fallbackEditorialHeaders.scheme,
    roster: portalCount
      ? 'How the Roster Really Shifts After ' + portalCount + ' Portal Additions'
      : fallbackEditorialHeaders.roster,
    recruiting:
      isRecruitingBattleArticleType(articleType)
        ? "Recruiting Battles That Define Florida's " + yr + ' Momentum'
        : fallbackEditorialHeaders.recruiting,
    analytics: "The Numbers Behind Florida's " + yr + ' Survival Curve',
    whatsNext: 'What Comes Next for Florida',
  };
}

function rewriteHeadersFallback(sections, meta = {}) {
  const base = dynamicFallbackHeaders(meta);
  const result = {};
  for (const key of Object.keys(sections)) {
    if (!sections[key]) continue;
    result[key] = base[key] || fallbackEditorialHeaders[key] || key;
  }
  return result;
}

async function rewriteHeadersWithLlm(sections, meta = {}) {
  const fallback = rewriteHeadersFallback(sections, meta);
  if (!isLlmAllowed()) return fallback;
  const result = { ...fallback };
  for (const key of Object.keys(sections)) {
    const content = sections[key];
    if (!content) continue;
    const plain = String(content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
    const prompt =
      'You are an Insider editorial editor. Write ONE short premium section headline (4-12 words). No quotes.\n' +
      'Section type: ' + key + '\nInstruction: ' + editorialHeaderPrompts[key] + '\nSection content:\n' + plain;
    try {
      const header = await generateHeader(prompt);
      if (header) result[key] = header;
    } catch {
      result[key] = fallback[key];
    }
  }
  return result;
}

module.exports = {
  fallbackEditorialHeaders,
  editorialHeaderPrompts,
  dynamicFallbackHeaders,
  rewriteHeadersFallback,
  rewriteHeadersWithLlm,
  generateHeader,
};