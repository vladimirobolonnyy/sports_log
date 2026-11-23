import { EXERCISES, SETS, fmtCount, fmtNum } from '../lib/format';
import type { Exercise, Workout, WorkoutSet } from './types';

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Tonnage of a set: weight × reps, 0 when either is missing. */
export const setVolume = (s: WorkoutSet): number => (s.weight != null && s.reps != null ? s.weight * s.reps : 0);
export const exerciseVolume = (e: Exercise): number => sum(e.sets.map(setVolume));
export const workoutVolume = (w: Workout): number => sum(w.exercises.map(exerciseVolume));
export const workoutSetCount = (w: Workout): number => sum(w.exercises.map((e) => e.sets.length));
export const setsMinutes = (w: Workout): number => sum(w.exercises.flatMap((e) => e.sets.map((s) => s.minutes ?? 0)));
export const workoutDistance = (w: Workout): number => sum(w.exercises.flatMap((e) => e.sets.map((s) => s.distance ?? 0)));

/** Minutes the workout counts for in statistics: its own duration if set, otherwise the time of its sets. */
export const workoutMinutes = (w: Workout): number => Math.round(w.minutes ?? setsMinutes(w));

export const workoutTitle = (w: Workout): string => w.title.trim() || 'Тренировка';

/** Key that treats «Жим лёжа», «жим  лежа» and «Жим лежа » as the same exercise. */
export const exerciseKey = (name: string): string => name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

/** «3 упражнения · 9 подходов · 2 340 кг · 1,5 км · 45 мин» */
export function workoutSummary(w: Workout): string {
  const parts: string[] = [];
  const sets = workoutSetCount(w);
  const volume = workoutVolume(w);
  const distance = workoutDistance(w);
  const minutes = workoutMinutes(w);
  if (w.exercises.length) parts.push(fmtCount(w.exercises.length, EXERCISES));
  if (sets) parts.push(fmtCount(sets, SETS));
  if (volume) parts.push(`${fmtNum(volume)} кг`);
  if (distance) parts.push(`${fmtNum(distance)} км`);
  if (minutes) parts.push(`${fmtNum(minutes)} мин`);
  return parts.join(' · ') || 'пока пусто';
}

/** «3 подхода · 1 080 кг», «3 подхода · 30 повт.», «1 подход · 1,5 км · 9 мин» */
export function exerciseSummary(e: Exercise): string {
  const parts = [fmtCount(e.sets.length, SETS)];
  const volume = exerciseVolume(e);
  const reps = sum(e.sets.map((s) => s.reps ?? 0));
  const distance = sum(e.sets.map((s) => s.distance ?? 0));
  const minutes = sum(e.sets.map((s) => s.minutes ?? 0));
  if (volume) parts.push(`${fmtNum(volume)} кг`);
  else if (reps) parts.push(`${fmtNum(reps)} повт.`);
  if (distance) parts.push(`${fmtNum(distance)} км`);
  if (minutes) parts.push(`${fmtNum(minutes)} мин`);
  return parts.join(' · ');
}
