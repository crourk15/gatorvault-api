/** PR-5 — complete-sentence validation and natural phrasing helpers. */

const VERB_RE =
  /\b(is|are|was|were|has|have|had|put|made|says|said|lists|listed|keeps|kept|earned|moved|told|cracked|spends|spending|remains|remained|became|gives|gave|helps|helped|shows|showed|landed|texting|visited|visiting|building|climbing|liked|knows|know|didn't|doesn't|could|can|will|would|should|makes|visited|watched|wants|want|called|calls|opened|opens|pushed|pushes|impressed|impresses|firmly|firm|holds|hold|surprised|surprises|separated|separates|separation|picked|picks|spent|gained|gain|gaining|moving|need|needs|fit|fits|stay|stays|pull|pulls|remain|open|opened|responded|respond|leaned|lean|leaning|widened|widen|positioned|position|working|work|calling|call|separate|separates|left|leave|pressing|press|loved|appreciated|seen|lead|leads|sell|landing|drives|drive|landing)\b/i;

const FRAGMENT_RE =
  /(?:^|[\s(])(?:visit|board|staff|spring|campus|gainesville|swamp|top schools|leaderboard)\s*\+|^[^.!?]*\+\s*[^.!?]*\.?$|^[^.!?]*\bwith on\.\s*$|^[^.!?]*\bwith first visit to\.\s*$|\b(?!(?:After|Before|During|Once)\b)[A-Z][a-z]+\s+his\s+on-campus\b/i;

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function ensurePeriod(text) {
  const t = String(text || '').trim();
  if (!t) return t;
  if (/[.!?]"?$/.test(t)) return t;
  return `${t}.`;
}

function isCompleteSentence(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (!/[.!?]"?$/.test(t)) return false;
  if (wordCount(t) < 6) return false;
  if (FRAGMENT_RE.test(t)) return false;
  if (/\s\+\s/.test(t)) return false;
  if (!VERB_RE.test(t)) return false;
  return true;
}

function lastName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(fullName || 'This prospect');
}

function visitPhrase(token) {
  const t = String(token || '').toLowerCase();
  if (/first trip.*swamp/i.test(t)) return 'his first trip to The Swamp';
  if (/first visit.*gainesville/i.test(t)) return 'his first visit to Gainesville';
  if (/on campus this spring/i.test(t)) return 'his on-campus visit this spring';
  if (/campus visit|on campus|early march/i.test(t)) return 'his campus visit';
  if (/another trip.*gainesville/i.test(t)) return 'another trip to Gainesville';
  if (/fnl|friday night lights/i.test(t)) return 'his Friday Night Lights visit';
  if (/gainesville|visit|campus/i.test(t)) return 'his Gainesville visit';
  return 'his recent campus visit';
}

function boardPhrase(token) {
  const t = String(token || '').toLowerCase();
  if (/top of my board/i.test(t)) return 'among his top schools';
  if (/top schools/i.test(t)) return 'one of his top schools';
  if (/cracked.*leaderboard|early leaderboard/i.test(t)) return 'on his early leaderboard';
  if (/leaderboard/i.test(t)) return 'on his leaderboard';
  return 'on his board';
}

function staffPhrase(token) {
  const t = String(token || '').toLowerCase();
  if (/all three db coaches/i.test(t)) return "all three Florida DB coaches are texting him";
  if (/staff contact|staff priority/i.test(t)) return 'Florida staff contact has picked up';
  return 'Florida staff contact has intensified';
}

module.exports = {
  VERB_RE,
  FRAGMENT_RE,
  wordCount,
  ensurePeriod,
  isCompleteSentence,
  lastName,
  visitPhrase,
  boardPhrase,
  staffPhrase
};
