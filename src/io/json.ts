import { isValidIso } from '../lib/dates';
import { newId } from '../model/ids';
import { isWorkoutType, type Exercise, type Workout, type WorkoutSet } from '../model/types';
import { DataError } from './errors';

/**
 * The JSON document is both the export format and what the app keeps in browser storage:
 *   { "format": "sport-log", "version": 2, "exportedAt"?: ISO time, "workouts": Workout[] }
 * Every version reads all older ones; a newer file is refused with a clear message instead of losing its new fields.
 * Version 2 added `distance` (km) to sets; in version 1 files it is simply absent.
 */
export const FORMAT = 'sport-log';
export const VERSION = 2;

export function serializeProfile(workouts: readonly Workout[], options: { pretty?: boolean; exportedAt?: string } = {}): string {
  const doc = {
    format: FORMAT,
    version: VERSION,
    ...(options.exportedAt ? { exportedAt: options.exportedAt } : {}),
    workouts,
  };
  return JSON.stringify(doc, null, options.pretty ? 2 : undefined);
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads a profile document (or a bare array of workouts). Throws DataError with a message for the user. */
export function parseProfile(text: string): Workout[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new DataError('Файл повреждён или это не JSON.');
  }
  let list: unknown;
  if (Array.isArray(data)) {
    list = data;
  } else if (isObject(data)) {
    if (data.format !== undefined && data.format !== FORMAT) {
      throw new DataError(`Это JSON другого приложения (format: «${String(data.format)}»).`);
    }
    if (typeof data.version === 'number' && data.version > VERSION) {
      throw new DataError('Файл сохранён более новой версией приложения. Обновите приложение и повторите.');
    }
    list = data.workouts;
  }
  if (!Array.isArray(list)) throw new DataError('В файле нет списка тренировок (поле «workouts»).');
  return withUniqueIds(list.map((w, i) => readWorkout(w, `Тренировка №${i + 1}`)));
}

function readWorkout(raw: unknown, where: string): Workout {
  if (!isObject(raw)) throw new DataError(`${where}: ожидался объект.`);
  if (typeof raw.date !== 'string' || !isValidIso(raw.date)) {
    throw new DataError(`${where}: неверная дата «${String(raw.date)}», нужен формат ГГГГ-ММ-ДД.`);
  }
  const exercises = raw.exercises ?? [];
  if (!Array.isArray(exercises)) throw new DataError(`${where}: «exercises» должен быть списком.`);
  return {
    id: readId(raw.id),
    date: raw.date,
    title: readText(raw.title, `${where}, название`),
    type: isWorkoutType(raw.type) ? raw.type : 'other',
    minutes: readNumber(raw.minutes, `${where}, длительность`),
    exercises: exercises.map((e, i) => readExercise(e, `${where}, упражнение №${i + 1}`)),
  };
}

function readExercise(raw: unknown, where: string): Exercise {
  if (!isObject(raw)) throw new DataError(`${where}: ожидался объект.`);
  const sets = raw.sets ?? [];
  if (!Array.isArray(sets)) throw new DataError(`${where}: «sets» должен быть списком.`);
  return {
    id: readId(raw.id),
    name: readText(raw.name, `${where}, название`),
    sets: sets.map((s, i) => readSet(s, `${where}, подход №${i + 1}`)),
  };
}

function readSet(raw: unknown, where: string): WorkoutSet {
  if (!isObject(raw)) throw new DataError(`${where}: ожидался объект.`);
  return {
    id: readId(raw.id),
    weight: readNumber(raw.weight, `${where}, вес`),
    reps: readNumber(raw.reps, `${where}, повторы`),
    minutes: readNumber(raw.minutes, `${where}, минуты`),
    distance: readNumber(raw.distance, `${where}, км`),
  };
}

const readId = (v: unknown): string => (typeof v === 'string' && v.trim() ? v : newId());

function readText(v: unknown, where: string): string {
  if (v == null) return '';
  if (typeof v !== 'string') throw new DataError(`${where}: ожидалась строка.`);
  return v;
}

function readNumber(v: unknown, where: string): number | null {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new DataError(`${where}: «${String(v)}» — нужно число не меньше нуля.`);
  }
  return v;
}

/** Hand-edited files may repeat ids; a repeated workout id would make two workouts edit as one. */
function withUniqueIds(workouts: Workout[]): Workout[] {
  const seen = new Set<string>();
  return workouts.map((w) => {
    if (!seen.has(w.id)) {
      seen.add(w.id);
      return w;
    }
    const id = newId();
    seen.add(id);
    return { ...w, id };
  });
}
