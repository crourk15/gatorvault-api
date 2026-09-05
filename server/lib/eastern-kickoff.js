/**
 * Parse Florida kickoff strings as America/New_York, not the host TZ.
 * "September 5, 2026 7:45 PM ET" must be 23:45Z on Render (UTC), not 19:45Z.
 */
'use strict';

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function easternLocalToDate(year, month, day, hour24, minute) {
  const wanted = Date.UTC(year, month - 1, day, hour24, minute, 0);
  let utc = wanted;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(utc)).map((p) => [p.type, p.value]));
    let hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    const got = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
      Number(parts.second || 0)
    );
    const diff = wanted - got;
    utc += diff;
    if (diff === 0) break;
  }
  return new Date(utc);
}

function parseEasternKickoff(dateStr) {
  const cleaned = String(dateStr || '')
    .replace(/\s*[·|]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /\b(TBA|TBD|OFF|FLEX)\b/i.test(cleaned)) return null;

  const m = cleaned.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?(?:\s*ET)?/i
  );
  if (!m) {
    const d = new Date(cleaned.replace(/\s*ET\s*$/i, '').trim());
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const month = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (!m[4]) {
    return easternLocalToDate(year, month, day, 12, 0);
  }

  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const ap = String(m[6] || 'AM').toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  return easternLocalToDate(year, month, day, hour, minute);
}

module.exports = {
  parseEasternKickoff,
  easternLocalToDate,
};
