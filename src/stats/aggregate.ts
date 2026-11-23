import { addDaysIso, mondayIso } from '../lib/dates';
import { exerciseKey, setVolume, workoutMinutes, workoutVolume } from '../model/derive';
import { WORKOUT_TYPES, type Workout, type WorkoutType } from '../model/types';

export interface WeekBucket {
  /** Monday, ISO. */
  readonly start: string;
  readonly count: number;
  readonly minutes: number;
  /** Tonnage, kg. */
  readonly volume: number;
}

/** The last `weeks` calendar weeks, oldest first, the current week included. */
export function weeklyBuckets(workouts: readonly Workout[], weeks: number, today: string): WeekBucket[] {
  const first = addDaysIso(mondayIso(today), -7 * (weeks - 1));
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: addDaysIso(first, 7 * i), count: 0, minutes: 0, volume: 0 }));
  const index = new Map(buckets.map((b, i) => [b.start, i]));
  for (const w of workouts) {
    const i = index.get(mondayIso(w.date));
    if (i === undefined) continue;
    const b = buckets[i]!;
    b.count++;
    b.minutes += workoutMinutes(w);
    b.volume += workoutVolume(w);
  }
  return buckets;
}

export interface TypeShare {
  readonly type: WorkoutType;
  readonly count: number;
  readonly minutes: number;
}

/** Workouts per type within [from, to], most frequent first. */
export function typeBreakdown(workouts: readonly Workout[], from: string, to: string): TypeShare[] {
  return WORKOUT_TYPES.map((type) => {
    const list = workouts.filter((w) => w.type === type && w.date >= from && w.date <= to);
    return { type, count: list.length, minutes: list.reduce((s, w) => s + workoutMinutes(w), 0) };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

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
  return [...map].map(([key, e]) => ({ key, name: e.name, sessions: e.sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'ru'));
}

export const EXERCISE_METRICS = ['maxWeight', 'volume', 'reps', 'minutes', 'distance'] as const;
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
      maxWeight: Math.max(0, ...sets.map((s) => s.weight ?? 0)),
      volume: sets.reduce((sum, s) => sum + setVolume(s), 0),
      reps: sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      minutes: sets.reduce((sum, s) => sum + (s.minutes ?? 0), 0),
      distance: sets.reduce((sum, s) => sum + (s.distance ?? 0), 0),
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
