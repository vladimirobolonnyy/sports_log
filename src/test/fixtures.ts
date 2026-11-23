import type { Exercise, Workout, WorkoutSet } from '../model/types';

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

export const set = (weight: number | null, reps: number | null, minutes: number | null = null, distance: number | null = null): WorkoutSet => ({
  id: id('s'),
  weight,
  reps,
  minutes,
  distance,
});

export const exercise = (name: string, sets: WorkoutSet[] = []): Exercise => ({ id: id('e'), name, sets });

export const workout = (
  date: string,
  options: { title?: string; minutes?: number | null; exercises?: Exercise[]; id?: string } = {},
): Workout => ({
  id: options.id ?? id('w'),
  date,
  title: options.title ?? '',
  minutes: options.minutes ?? null,
  exercises: options.exercises ?? [],
});

/** Drops generated ids so that structures read back from a file can be compared with the originals. */
export function withoutIds(workouts: readonly Workout[]) {
  return workouts.map(({ id: _w, exercises, ...w }) => ({
    ...w,
    exercises: exercises.map(({ id: _e, sets, ...e }) => ({ ...e, sets: sets.map(({ id: _s, ...s }) => s) })),
  }));
}
