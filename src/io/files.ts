import type { Workout } from '../model/types';
import { csvToWorkouts } from './csv';
import { parseProfile } from './json';

export type Delivery = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands a generated file to the user.
 * On phones the share sheet is used: in an iOS Home Screen web app a download link leads to a dead-end screen,
 * while the share sheet offers «Сохранить в Файлы», AirDrop, messengers. Desktops get a regular download.
 * Must be called straight from a click handler: navigator.share() needs the user gesture, so nothing is awaited before it.
 */
export async function deliverFile(name: string, text: string, mime: string): Promise<Delivery> {
  const file = new File([text], name, { type: mime });
  // Some browsers share only an allow-list of types (Chrome has no application/json there); the same file as
  // text/plain keeps its name and extension, so it still lands in «Файлы» as .json.
  const shareable = [file, new File([text], name, { type: 'text/plain' })].find((f) => navigator.canShare?.({ files: [f] }));
  if (matchMedia('(pointer: coarse)').matches && shareable) {
    try {
      await navigator.share({ files: [shareable] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // NotAllowedError and friends: fall back to a download below.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

/** JSON or CSV, by extension or, failing that, by content. Throws DataError. */
export function parseProfileFile(fileName: string, text: string): Workout[] {
  const looksJson = /\.json$/i.test(fileName) || (!/\.csv$/i.test(fileName) && /^﻿?\s*[[{]/.test(text));
  return looksJson ? parseProfile(text) : csvToWorkouts(text);
}

export interface ProfileSummary {
  readonly workouts: number;
  readonly exercises: number;
  readonly sets: number;
  readonly from: string | null;
  readonly to: string | null;
}

export function summarize(workouts: readonly Workout[]): ProfileSummary {
  const dates = workouts.map((w) => w.date).sort();
  return {
    workouts: workouts.length,
    exercises: workouts.reduce((n, w) => n + w.exercises.length, 0),
    sets: workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}
