export const WORKOUT_TYPES = ['strength', 'cardio', 'hiit', 'mobility', 'stretching', 'yoga', 'other'] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const isWorkoutType = (value: unknown): value is WorkoutType =>
  typeof value === 'string' && (WORKOUT_TYPES as readonly string[]).includes(value);

export const TYPE_META: Readonly<Record<WorkoutType, { label: string; icon: string }>> = {
  strength: { label: 'Силовая', icon: '💪' },
  cardio: { label: 'Кардио', icon: '🏃' },
  hiit: { label: 'HIIT', icon: '⚡' },
  mobility: { label: 'Мобильность', icon: '🤸' },
  stretching: { label: 'Растяжка', icon: '🙆' },
  yoga: { label: 'Йога', icon: '🧘' },
  other: { label: 'Другое', icon: '🏅' },
};

/** One set. Every value is optional: a plank has only minutes, pull-ups only reps, a warm-up minutes and km. */
export interface WorkoutSet {
  readonly id: string;
  /** Kilograms. */
  readonly weight: number | null;
  readonly reps: number | null;
  readonly minutes: number | null;
  /** Kilometres. */
  readonly distance: number | null;
}

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly sets: readonly WorkoutSet[];
}

export interface Workout {
  readonly id: string;
  /** Local calendar day, YYYY-MM-DD. */
  readonly date: string;
  /** Empty means «untitled»: the type label is shown instead. */
  readonly title: string;
  readonly type: WorkoutType;
  /** Duration of the whole workout; null means «use the sum of the sets' minutes». */
  readonly minutes: number | null;
  readonly exercises: readonly Exercise[];
}
