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
  /** Empty means «untitled». */
  readonly title: string;
  /** Duration of the whole workout; null means «use the sum of the sets' minutes». */
  readonly minutes: number | null;
  readonly exercises: readonly Exercise[];
}
