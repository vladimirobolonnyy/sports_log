import { addDaysIso, mondayIso } from '../lib/dates';

export interface StreakInfo {
  /** Monday (ISO) of every week with at least one workout → number of workouts that week. */
  readonly weeks: ReadonlyMap<string, number>;
  /** Weeks in a row with a workout. */
  readonly count: number;
  /** Workouts in those weeks. */
  readonly workouts: number;
  /** Monday of the streak's latest week, null when there is no streak. */
  readonly end: string | null;
}

/**
 * Streak = weeks in a row (Mon–Sun) with at least one workout, counted back from the current week.
 * The current week does not break the streak while it is still going and has no workout yet.
 * Same rule as the statistics of workouts.html.
 */
export function streakInfo(dates: readonly string[], today: string): StreakInfo {
  const weeks = new Map<string, number>();
  for (const d of dates) {
    const w = mondayIso(d);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  const thisWeek = mondayIso(today);
  let week = weeks.has(thisWeek) ? thisWeek : addDaysIso(thisWeek, -7);
  const end = week;
  let count = 0;
  let workouts = 0;
  for (let n = weeks.get(week); n !== undefined; n = weeks.get(week)) {
    count++;
    workouts += n;
    week = addDaysIso(week, -7);
  }
  return { weeks, count, workouts, end: count ? end : null };
}
