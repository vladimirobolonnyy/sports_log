const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/** «4 520», «62,5» */
export const fmtNum = (n: number): string => decimal.format(n);

/** Axis labels: «12 тыс.» instead of «12 000» once numbers get long. */
export const fmtAxis = (n: number): string => (Math.abs(n) >= 10_000 ? compact.format(n) : decimal.format(n));

export type PluralForms = readonly [one: string, few: string, many: string];

export function plural(n: number, [one, few, many]: PluralForms): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  return b > 1 && b < 5 ? few : many;
}

/** «3 подхода» */
export const fmtCount = (n: number, forms: PluralForms): string => `${fmtNum(n)} ${plural(n, forms)}`;

export const WORKOUTS: PluralForms = ['тренировка', 'тренировки', 'тренировок'];
export const EXERCISES: PluralForms = ['упражнение', 'упражнения', 'упражнений'];
export const SETS: PluralForms = ['подход', 'подхода', 'подходов'];
export const WEEKS: PluralForms = ['неделя', 'недели', 'недель'];
export const DAYS: PluralForms = ['день', 'дня', 'дней'];

/** A number the way it is typed into an input: decimal comma, no grouping. */
export const toInputText = (n: number | null): string => (n == null ? '' : String(n).replace('.', ','));

/**
 * Cleans what is being typed into a number field: digits and, for decimals, one «,» (a «.» becomes «,»)
 * with up to two digits after it; at most 6 digits before it.
 */
export function sanitizeNumber(raw: string, integer: boolean): string {
  const s = raw.replace(/\./g, ',').replace(/[^\d,]/g, '');
  if (integer) return s.replace(/,/g, '').slice(0, 6);
  const [whole = '', ...rest] = s.split(',');
  return rest.length ? `${whole.slice(0, 6)},${rest.join('').slice(0, 2)}` : whole.slice(0, 6);
}
