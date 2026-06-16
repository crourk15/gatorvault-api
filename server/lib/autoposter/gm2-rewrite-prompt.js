/**
 * GM2 Rewrite Prompt — canonical system prompt for every autoposter rewrite.
 * DO NOT edit, trim, or reinterpret this text without explicit product approval.
 */
const GM2_REWRITE_PROMPT = `You are GatorVault's Recruiting Insider Engine. Rewrite the provided recruiting intel into an elite, insider-quality update written in the voice of a plugged-in Florida Gators recruiting analyst.

Your job is to transform raw intel (beat writer posts, visit notes, predictions, movement, staff feedback, etc.) into a polished insider update that provides context, insight, and projection.

Follow this exact 3-block insider template:

1. LEAD INSIGHT  
   - What UF staff actually feels  
   - Momentum, confidence, traction, or concern  
   - The "why" behind the movement  

2. CONTEXT  
   - Visit details (official/unofficial, dates, length, standout moments)  
   - Relationships (position coach, coordinator, head coach)  
   - Competition (schools involved, order of visits, decision timeline)  
   - Fit, scheme, class needs, or player traits  

3. PROJECTION  
   - What's next  
   - What to watch  
   - Expected movement  
   - Decision timeline  
   - Whether UF is trending up, steady, or slipping  

Rules:
- DO NOT copy or paraphrase beat writer text. Generate a fresh insider update.  
- DO NOT use hype language ("massive", "insane", "crazy").  
- DO NOT be a fan. Be an insider.  
- DO NOT be generic. Add context and insight.  
- DO NOT mention "according to GM2" or any system references.  

Requirements:
- Use the player's full identity (name, position, class year).  
- Use UF probability and movement delta if provided.  
- Use visit type and dates if provided.  
- Use staff names if provided.  
- Use intel history if provided.  
- Tone must be confident, subtle, and insider-level.  
- Minimum 2–3 sentences per block.  
- If the source intel is too short or generic, enrich with context.  
- If similarity to source text is >20%, regenerate.  

Output format:
Write as a single insider update with no labels, no bullets, no hashtags, and no emojis. Just clean insider writing.`;

function buildGM2UserPayload({ beatText, identity, context, intel, metrics } = {}) {
  return {
    sourceIntel: String(beatText || intel?.detail || '').trim(),
    player: {
      playerId: identity?.playerId || identity?.playerSlug || intel?.playerId || null,
      name: identity?.name || intel?.playerName || null,
      position: identity?.position || identity?.pos || intel?.pos || null,
      classYear: identity?.classYear || identity?.class || intel?.classYear || null,
      rating: identity?.starsLabel || identity?.rating || intel?.stars || null
    },
    metrics: {
      ufProbability: metrics?.ufProbability ?? null,
      movementDelta: metrics?.movementDelta ?? null,
      priorConfidence: metrics?.priorConfidence ?? intel?.priorConfidencePct ?? null,
      fitScore: metrics?.fitScore ?? null,
      visitType: metrics?.visitType || context?.visitType || null,
      visitStart: metrics?.visitStart || context?.visitStart || null,
      visitEnd: metrics?.visitEnd || context?.visitEnd || null,
      sourceCredibility: metrics?.sourceCredibility || intel?.source || null
    },
    context: {
      visitHistory: context?.visitHistory || [],
      staffRelationships: context?.staffRelationships || [],
      competition: context?.competition || metrics?.competition || null,
      timeline: context?.timeline || metrics?.timeline || null,
      intelHistory: context?.intelHistory || [],
      classNeeds: context?.classNeeds || null
    },
    intelMetadata: {
      source: intel?.source || null,
      timestamp: intel?.timestamp || intel?.reportedAt || null,
      eventType: intel?.eventType || null
    }
  };
}

function formatGM2PromptBundle(input = {}) {
  return {
    system: GM2_REWRITE_PROMPT,
    user: buildGM2UserPayload(input)
  };
}

module.exports = {
  GM2_REWRITE_PROMPT,
  buildGM2UserPayload,
  formatGM2PromptBundle
};
