import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  addMonthsIso,
  daysBetween,
  fmtDayLong,
  fmtWeekRange,
  isValidIso,
  mondayIso,
  monthWeeks,
} from './dates';

describe('dates', () => {
  it('validates ISO days', () => {
    expect(isValidIso('2026-11-23')).toBe(true);
    expect(isValidIso('2024-02-29')).toBe(true);
    expect(isValidIso('2026-02-29')).toBe(false);
    expect(isValidIso('2026-13-01')).toBe(false);
    expect(isValidIso('23.11.2026')).toBe(false);
    expect(isValidIso('')).toBe(false);
  });

  it('finds the Monday of a week', () => {
    expect(mondayIso('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(mondayIso('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(mondayIso('2026-11-01')).toBe('2026-10-26'); // Sunday across a month
  });

  it('adds days and months across boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonthsIso('2026-01-01', -1)).toBe('2025-12-01');
  });

  it('counts days across a DST change', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-11-30', '2026-11-23')).toBe(-7);
  });

  it('lists the weeks that cover a month', () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    expect(monthWeeks('2026-11-15')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    // February 2027 starts on a Monday and has exactly four weeks.
    expect(monthWeeks('2027-02-01')).toEqual(['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
  });

  it('formats days and week ranges in Russian', () => {
    expect(fmtDayLong('2026-11-23', '2026-11-23')).toBe('Пн, 23 ноября');
    expect(fmtDayLong('2025-01-05', '2026-11-23')).toBe('Вс, 5 января 2025');
    expect(fmtWeekRange('2026-11-16')).toBe('16–22 ноября');
    expect(fmtWeekRange('2026-10-26')).toBe('26 октября – 1 ноября');
  });
});
