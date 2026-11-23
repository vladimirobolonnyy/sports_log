import { exerciseKey } from '../model/derive';
import type { Workout } from '../model/types';

export interface ExerciseEntry {
  readonly key: string;
  /** The most recent spelling of the name. */
  readonly name: string;
  /** Workouts that contain the exercise. */
  readonly sessions: number;
}

/** Every named exercise, most frequent first. */
export function exerciseCatalog(workouts: readonly Workout[]): ExerciseEntry[] {
  const map = new Map<string, { name: string; date: string; sessions: number }>();
  for (const w of workouts) {
    const seen = new Set<string>();
    for (const e of w.exercises) {
      const key = exerciseKey(e.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = map.get(key);
      if (!entry) map.set(key, { name: e.name.trim(), date: w.date, sessions: 1 });
      else {
        entry.sessions++;
        if (w.date >= entry.date) Object.assign(entry, { name: e.name.trim(), date: w.date });
      }
    }
  }
  return [...map]
    .map(([key, e]) => ({ key, name: e.name, sessions: e.sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'ru'));
}

/** What a chart of an exercise shows: weight is the heaviest set of the workout, the rest are totals of the workout. */
export const EXERCISE_METRICS = ['weight', 'reps', 'minutes', 'distance'] as const;
export type ExerciseMetric = (typeof EXERCISE_METRICS)[number];

export interface ExercisePoint extends Record<ExerciseMetric, number> {
  readonly date: string;
  readonly workoutId: string;
}

/** One point per workout that contains the exercise (all its entries in that workout combined), oldest first. */
export function exerciseSeries(workouts: readonly Workout[], key: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const w of workouts) {
    const matched = w.exercises.filter((e) => exerciseKey(e.name) === key);
    if (!matched.length) continue;
    const sets = matched.flatMap((e) => e.sets);
    points.push({
      date: w.date,
      workoutId: w.id,
      weight: Math.max(0, ...sets.map((s) => s.weight ?? 0)),
      reps: sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      minutes: sets.reduce((sum, s) => sum + (s.minutes ?? 0), 0),
      distance: sets.reduce((sum, s) => sum + (s.distance ?? 0), 0),
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
