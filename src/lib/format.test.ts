import { describe, expect, it } from 'vitest';
import { SETS, fmtCount, plural, sanitizeNumber, toInputText } from './format';

describe('format', () => {
  it('picks Russian plural forms', () => {
    const forms = ['подход', 'подхода', 'подходов'] as const;
    expect([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((n) => plural(n, forms))).toEqual([
      'подходов',
      'подход',
      'подхода',
      'подхода',
      'подходов',
      'подходов',
      'подходов',
      'подходов',
      'подход',
      'подхода',
      'подходов',
      'подход',
      'подходов',
    ]);
    expect(fmtCount(3, SETS)).toBe('3 подхода');
  });

  it('cleans typed decimals', () => {
    expect(sanitizeNumber('62.5', false)).toBe('62,5');
    expect(sanitizeNumber('62,', false)).toBe('62,');
    expect(sanitizeNumber('1,2,3', false)).toBe('1,23');
    expect(sanitizeNumber('7,125', false)).toBe('7,12');
    expect(sanitizeNumber(' 1 0 кг', false)).toBe('10');
    expect(sanitizeNumber('-5', false)).toBe('5');
    expect(sanitizeNumber('12345678', false)).toBe('123456');
  });

  it('cleans typed integers', () => {
    expect(sanitizeNumber('12,5', true)).toBe('125');
    expect(sanitizeNumber('abc', true)).toBe('');
  });

  it('formats numbers for inputs with a decimal comma', () => {
    expect(toInputText(null)).toBe('');
    expect(toInputText(62.5)).toBe('62,5');
    expect(toInputText(80)).toBe('80');
  });
});
