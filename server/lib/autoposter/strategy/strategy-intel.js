/** PR-5 — one factual beat sentence for the intel line (v2). */

const { stripUrls } = require('./strategy-extract');
const { ensurePeriod, isCompleteSentence, lastName } = require('./strategy-sentences');

function stripHeadline(beatText) {
  return String(beatText || '')
    .replace(/^NEW:\s*/i, '')
    .replace(/Intel:\s*https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIntelSentence(signal) {
  const beat = stripHeadline(stripUrls(signal?.beatText || signal?.event?.description || ''));
  const name = signal?.player?.name || '';
  const ln = lastName(name);
  if (!beat || beat.length < 24 || !name) return null;

  if (/all three.*db coaches texting/i.test(beat) && /first visit.*gainesville/i.test(beat)) {
    return ensurePeriod(`${ln} said Florida's DB coaches are texting him after Gainesville`);
  }
  if (/first trip to the swamp/i.test(beat)) {
    return ensurePeriod(`${ln} impressed Florida on his first trip to The Swamp`);
  }
  if (/on campus this spring.*spring practice/i.test(beat)) {
    return ensurePeriod(`${ln} was on campus this spring for Florida's spring practice`);
  }
  if (/on campus at florida in early march/i.test(beat)) {
    return ensurePeriod(`${ln} was on Florida's campus in early March`);
  }
  if (/another trip to gainesville/i.test(beat)) {
    return ensurePeriod(`${ln} said another trip to Gainesville could happen soon`);
  }
  if (/on campus multiple times this spring/i.test(beat)) {
    return ensurePeriod(`${ln} has been on Florida's campus multiple times this spring`);
  }
  if (/didn't need an offer/i.test(beat)) {
    return ensurePeriod(`${ln} said he did not need a Florida offer to know the Gators were serious`);
  }
  if (/rpm pick|on3 rpm|\brpm\b/i.test(beat) && signal?.metrics?.rpm != null) {
    return ensurePeriod(`On3 RPM still has Florida leading for ${name}`);
  }

  const sentences = beat.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 24);
  for (const raw of sentences) {
    const clean = raw.replace(/^NEW:\s*/i, '').trim();
    if (!clean || /^https?:\/\//i.test(clean)) continue;
    const line = ensurePeriod(clean);
    if (isCompleteSentence(line) && line.toLowerCase().includes(ln.toLowerCase())) {
      return line;
    }
  }

  return null;
}

module.exports = {
  buildIntelSentence,
  stripHeadline
};
