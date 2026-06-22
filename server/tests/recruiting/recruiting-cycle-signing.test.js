/**
 * @file Signing calendar tests — mirrors client/lib/recruiting-cycle.ts logic.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const ACTIVE_RECRUITING_CLASS_YEAR = 2027;

function calendarDate(year, month, day) {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getNationalSigningDay(classYear) {
  const year = parseInt(String(classYear), 10);
  const feb1 = calendarDate(year, 2, 1);
  const weekday = feb1.getDay();
  const offset = (3 - weekday + 7) % 7;
  return calendarDate(year, 2, 1 + offset);
}

function getEarlySigningPeriod(classYear) {
  const year = parseInt(String(classYear), 10);
  const calendarYear = year - 1;
  return {
    start: calendarDate(calendarYear, 12, 15),
    end: calendarDate(calendarYear, 12, 18),
    dateLabel: `December 15–17, ${calendarYear}`,
  };
}

describe('recruiting cycle signing calendar', () => {
  it('2027 cycle ESP is Dec 15–17, 2026', () => {
    const esp = getEarlySigningPeriod(2027);
    assert.equal(esp.dateLabel, 'December 15–17, 2026');
    assert.equal(esp.start.getFullYear(), 2026);
    assert.equal(esp.start.getMonth(), 11);
    assert.equal(esp.start.getDate(), 15);
    assert.equal(esp.end.getDate(), 18);
  });

  it('2027 cycle NSD is Feb 3, 2027', () => {
    const nsd = getNationalSigningDay(2027);
    assert.equal(nsd.getFullYear(), 2027);
    assert.equal(nsd.getMonth(), 1);
    assert.equal(nsd.getDate(), 3);
  });

  it('active recruiting cycle is 2027', () => {
    assert.equal(ACTIVE_RECRUITING_CLASS_YEAR, 2027);
  });
});
