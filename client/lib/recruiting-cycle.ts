/**
 * Active recruiting cycle + signing calendar dates derived from class year.
 *
 * Class of 2027 signs during ESP (Dec 15–17, 2026) and NSD (first Wednesday in Feb 2027).
 */
export const ACTIVE_RECRUITING_CLASS_YEAR = 2027;

export type SigningCalendar = {
  classYear: number;
  esp: {
    start: Date;
    end: Date;
    dateLabel: string;
  };
  nsd: {
    start: Date;
    end: Date;
    dateLabel: string;
  };
};

function calendarDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatMonthDayYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** First Wednesday in February — NCAA National Signing Day. */
export function getNationalSigningDay(classYear: number): Date {
  const year = parseInt(String(classYear), 10);
  const feb1 = calendarDate(year, 2, 1);
  const weekday = feb1.getDay();
  const offset = (3 - weekday + 7) % 7;
  return calendarDate(year, 2, 1 + offset);
}

/** Early Signing Period — Dec 15–17 before the class year. */
export function getEarlySigningPeriod(classYear: number): {
  start: Date;
  end: Date;
  dateLabel: string;
} {
  const year = parseInt(String(classYear), 10);
  const calendarYear = year - 1;
  const start = calendarDate(calendarYear, 12, 15);
  const end = calendarDate(calendarYear, 12, 18);
  return {
    start,
    end,
    dateLabel: `December 15–17, ${calendarYear}`,
  };
}

export function getSigningCalendar(classYear = ACTIVE_RECRUITING_CLASS_YEAR): SigningCalendar {
  const year = parseInt(String(classYear), 10);
  const esp = getEarlySigningPeriod(year);
  const nsdDay = getNationalSigningDay(year);
  const nsdStart = calendarDate(nsdDay.getFullYear(), nsdDay.getMonth() + 1, nsdDay.getDate());
  const nsdEnd = calendarDate(nsdDay.getFullYear(), nsdDay.getMonth() + 1, nsdDay.getDate() + 1);

  return {
    classYear: year,
    esp,
    nsd: {
      start: nsdStart,
      end: nsdEnd,
      dateLabel: formatMonthDayYear(nsdDay),
    },
  };
}
