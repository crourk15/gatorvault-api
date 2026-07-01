/** LLM article generation - OpenAI-compatible chat API. */
const { EDITORIAL_SYSTEM_PROMPT, buildUserPrompt } = require('./insider-articles-prompt');

function isLlmEnabled() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY);
}

function llmModel() {
  return process.env.INSIDER_ARTICLE_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function parseJsonResponse(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  return JSON.parse(body);
}

async function generateWithLlm({ articleType, title, angleKey, context, topic }) {
  if (!isLlmEnabled()) return null;
  const apiKey = process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const userPrompt = buildUserPrompt({ articleType, title, angleKey, context, topic });
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0.65,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EDITORIAL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${errText.slice(0, 240)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  const parsed = parseJsonResponse(content);
  if (!parsed?.bodyHtml || !parsed?.title) throw new Error('LLM JSON missing title or bodyHtml');
  return {
    articleType: parsed.articleType || articleType,
    thesis: parsed.thesis || '',
    title: parsed.title,
    summary: parsed.summary || parsed.thesis || '',
    body: parsed.bodyHtml,
    insiderAngles: parsed.insiderAngles || [],
    sourcesUsed: parsed.sourcesUsed || ['GatorVault'],
  };
}

module.exports = { generateWithLlm, isLlmEnabled, llmModel };