// Every date in the app is a local calendar day in ISO form (YYYY-MM-DD): no times, no time zones.
// ISO strings compare correctly as plain strings, which the code relies on.

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseIso(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Rejects both a wrong shape and an impossible day such as 2026-02-30. */
export const isValidIso = (iso: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(iso) && isoDate(parseIso(iso)) === iso;

export const todayIso = (): string => isoDate(new Date());

const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addDaysIso = (iso: string, n: number): string => isoDate(addDays(parseIso(iso), n));

/** Monday of the week (Mon–Sun) that contains the day. */
export function mondayIso(iso: string): string {
  const d = parseIso(iso);
  return isoDate(addDays(d, -((d.getDay() + 6) % 7)));
}

export const monthStartIso = (iso: string): string => `${iso.slice(0, 7)}-01`;

export function addMonthsIso(iso: string, n: number): string {
  const d = parseIso(iso);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Whole days from `from` to `to`; DST-safe because it counts in UTC. */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const d = parseIso(iso);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** Mondays of the weeks that cover the whole month of `iso`. */
export function monthWeeks(iso: string): string[] {
  const first = parseIso(monthStartIso(iso));
  const last = isoDate(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const weeks: string[] = [];
  for (let w = mondayIso(isoDate(first)); w <= last; w = addDaysIso(w, 7)) weeks.push(w);
  return weeks;
}

/** «Пн, 23 ноября», with the year when it is not the current one. */
export function fmtDayLong(iso: string, today: string = todayIso()): string {
  const d = parseIso(iso);
  const year = iso.slice(0, 4) === today.slice(0, 4) ? '' : ` ${d.getFullYear()}`;
  return `${DOW[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${year}`;
}

/** «23 ноя» */
export function fmtDayMonth(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** «23.11.2026» */
export const fmtDateShort = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** «Ноябрь 2026» */
export function fmtMonthTitle(iso: string): string {
  const d = parseIso(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** «17–23 ноября» or «27 октября – 2 ноября» for the week starting on `monday`. */
export function fmtWeekRange(monday: string): string {
  const a = parseIso(monday);
  const b = parseIso(addDaysIso(monday, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
}
