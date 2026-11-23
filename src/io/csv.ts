import { isValidIso } from '../lib/dates';
import { newId } from '../model/ids';
import type { Workout, WorkoutSet } from '../model/types';
import { DataError } from './errors';

/*
 * CSV for Excel/Numbers: one row per set, «;» as the delimiter, decimal comma, UTF-8 with BOM.
 * A workout without exercises and an exercise without sets get one row each with the empty columns.
 * Import finds columns by header name, so their order may change and extra columns are ignored
 * (including «Тип» from files of the earlier version, which had workout types).
 */

type Column = 'date' | 'workout' | 'workoutMinutes' | 'exercise' | 'set' | 'weight' | 'reps' | 'minutes' | 'distance' | 'id';

const COLUMNS: readonly { key: Column; title: string; alias: string }[] = [
  { key: 'date', title: 'Дата', alias: 'date' },
  { key: 'workout', title: 'Тренировка', alias: 'workout' },
  { key: 'workoutMinutes', title: 'Длительность, мин', alias: 'workout_minutes' },
  { key: 'exercise', title: 'Упражнение', alias: 'exercise' },
  { key: 'set', title: 'Подход', alias: 'set' },
  { key: 'weight', title: 'Вес, кг', alias: 'weight_kg' },
  { key: 'reps', title: 'Повторы', alias: 'reps' },
  { key: 'minutes', title: 'Время, мин', alias: 'set_minutes' },
  { key: 'distance', title: 'Дистанция, км', alias: 'distance_km' },
  { key: 'id', title: 'ID тренировки', alias: 'workout_id' },
];

const DELIMITER = ';';
const EOL = '\r\n';
const BOM = '﻿';

const cell = (value: string): string => (/[";\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const numberCell = (n: number | null): string => (n == null ? '' : String(n).replace('.', ','));

export function workoutsToCsv(workouts: readonly Workout[]): string {
  const lines = [COLUMNS.map((c) => cell(c.title)).join(DELIMITER)];
  const push = (w: Workout, exercise: string, setNo: string, set: Omit<WorkoutSet, 'id'> | null) => {
    const values: Record<Column, string> = {
      date: w.date,
      workout: w.title,
      workoutMinutes: numberCell(w.minutes),
      exercise,
      set: setNo,
      weight: numberCell(set?.weight ?? null),
      reps: numberCell(set?.reps ?? null),
      minutes: numberCell(set?.minutes ?? null),
      distance: numberCell(set?.distance ?? null),
      id: w.id,
    };
    lines.push(COLUMNS.map((c) => cell(values[c.key])).join(DELIMITER));
  };
  for (const w of workouts) {
    if (!w.exercises.length) push(w, '', '', null);
    for (const e of w.exercises) {
      if (!e.sets.length) push(w, e.name, '', null);
      e.sets.forEach((s, i) => push(w, e.name, String(i + 1), s));
    }
  }
  return BOM + lines.join(EOL) + EOL;
}

type MutableExercise = { id: string; name: string; sets: WorkoutSet[] };
type MutableWorkout = Omit<Workout, 'exercises'> & { exercises: MutableExercise[] };

export function csvToWorkouts(text: string): Workout[] {
  const rows = parseCsvRows(text);
  const header = rows[0];
  if (!header || header.every((h) => !h.trim())) throw new DataError('Файл пустой.');
  const index = new Map<Column, number>();
  header.forEach((h, i) => {
    const key = columnFor(h);
    if (key && !index.has(key)) index.set(key, i);
  });
  if (!index.has('date')) {
    throw new DataError('В первой строке нет колонки «Дата» — это не CSV, сохранённый приложением.');
  }

  const result: MutableWorkout[] = [];
  const byId = new Map<string, MutableWorkout>();
  let workout: MutableWorkout | null = null;
  let workoutKey = '';
  let exercise: MutableExercise | null = null;
  let lastSetNo: number | null = null;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    if (cells.every((c) => !c.trim())) continue;
    const line = r + 1;
    const get = (key: Column): string => {
      const i = index.get(key);
      return i == null ? '' : (cells[i] ?? '').trim();
    };

    const date = parseDate(get('date'), line);
    const title = get('workout');
    const workoutMinutes = parseNumber(get('workoutMinutes'), line, 'Длительность, мин');
    const id = get('id');
    // Rows of one workout share its id; rows written by hand without ids are grouped while date and title repeat.
    const key = id ? `id:${id}` : `row:${date}|${title}|${workoutMinutes}`;
    if (!workout || key !== workoutKey) {
      const known = id ? byId.get(id) : undefined;
      if (known) {
        workout = known;
      } else {
        workout = { id: id || newId(), date, title, minutes: workoutMinutes, exercises: [] };
        result.push(workout);
        if (id) byId.set(id, workout);
      }
      workoutKey = key;
      exercise = null;
      lastSetNo = null;
    }

    const name = get('exercise');
    const setNo = parseNumber(get('set'), line, 'Подход', true);
    const weight = parseNumber(get('weight'), line, 'Вес, кг');
    const reps = parseNumber(get('reps'), line, 'Повторы', true);
    const minutes = parseNumber(get('minutes'), line, 'Время, мин');
    const distance = parseNumber(get('distance'), line, 'Дистанция, км');
    const hasSet = setNo != null || weight != null || reps != null || minutes != null || distance != null;
    if (!name && !hasSet) continue; // a workout-only row

    // The same exercise twice in a row is two exercises when its set numbers start over.
    const restarts = setNo != null && lastSetNo != null && setNo <= lastSetNo;
    if (!exercise || exercise.name !== name || restarts) {
      exercise = { id: newId(), name, sets: [] };
      workout.exercises.push(exercise);
    }
    if (hasSet) exercise.sets.push({ id: newId(), weight, reps, minutes, distance });
    lastSetNo = setNo;
  }
  return result;
}

function columnFor(header: string): Column | undefined {
  const h = header.trim().toLowerCase();
  return COLUMNS.find((c) => c.title.toLowerCase() === h || c.alias === h)?.key;
}

function parseDate(raw: string, line: number): string {
  const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
  // Excel re-saves dates as ДД.ММ.ГГГГ in the Russian locale and sometimes appends a time.
  const iso = ru ? `${ru[3]}-${ru[2]!.padStart(2, '0')}-${ru[1]!.padStart(2, '0')}` : raw.replace(/^(\d{4}-\d{2}-\d{2})[ T].*$/, '$1');
  if (!isValidIso(iso)) {
    throw new DataError(`Строка ${line}: неверная дата «${raw}». Нужен формат ГГГГ-ММ-ДД или ДД.ММ.ГГГГ.`);
  }
  return iso;
}

function parseNumber(raw: string, line: number, column: string, integer = false): number | null {
  const s = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw new DataError(`Строка ${line}, колонка «${column}»: «${raw}» — нужно ${integer ? 'целое ' : ''}число не меньше нуля.`);
  }
  return n;
}

/** RFC 4180 rows. The delimiter («;», «,» or tab) is taken from the header line. */
export function parseCsvRows(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (src[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(src: string): string {
  const end = src.search(/\r|\n/);
  const header = end === -1 ? src : src.slice(0, end);
  const count = (d: string) => header.split(d).length - 1;
  return [DELIMITER, ',', '\t'].reduce((best, d) => (count(d) > count(best) ? d : best));
}
