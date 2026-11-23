import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import {
  DOW,
  addDaysIso,
  addMonthsIso,
  fmtDayLong,
  fmtMonthTitle,
  monthStartIso,
  monthWeeks,
  parseIso,
  todayIso,
} from '../lib/dates';
import { WEEKS, WORKOUTS, fmtCount } from '../lib/format';
import { workoutMinutes, workoutTitle } from '../model/derive';
import type { Workout } from '../model/types';
import { streakInfo } from '../stats/streak';
import { store } from '../store';
import { recordWorkout } from './actions';
import { Kpi, WorkoutRow } from './components';

// Kept outside the component: the shown month and the picked day survive switching tabs.
const shownMonth = signal(monthStartIso(todayIso()));
const pickedDay = signal(todayIso());

function groupByDay(workouts: readonly Workout[]): Map<string, Workout[]> {
  const map = new Map<string, Workout[]>();
  for (const w of workouts) {
    const list = map.get(w.date);
    if (list) list.push(w);
    else map.set(w.date, [w]);
  }
  return map;
}

/** Month calendar with the weekly streak, as on the statistics page of workouts.html. */
export function CalendarScreen() {
  const workouts = store.workouts.value;
  const today = todayIso();
  const month = shownMonth.value;
  const day = pickedDay.value;
  const byDay = useMemo(() => groupByDay(workouts), [workouts]);
  const streak = useMemo(() => streakInfo(workouts.map((w) => w.date), today), [workouts, today]);
  const prefix = month.slice(0, 8);
  const inMonth = workouts.filter((w) => w.date.startsWith(prefix));
  const monthMinutes = inMonth.reduce((s, w) => s + workoutMinutes(w), 0);
  const weeks = monthWeeks(month);

  const pick = (iso: string) => {
    pickedDay.value = iso;
    if (!iso.startsWith(prefix)) shownMonth.value = monthStartIso(iso);
  };

  return (
    <div class="stats-wrap">
      <section class="box">
        <div class="st-head">
          <div class="st-month">
            <button type="button" class="icon-btn" aria-label="Предыдущий месяц" onClick={() => (shownMonth.value = addMonthsIso(month, -1))}>
              ‹
            </button>
            <h2>{fmtMonthTitle(month)}</h2>
            <button type="button" class="icon-btn" aria-label="Следующий месяц" onClick={() => (shownMonth.value = addMonthsIso(month, 1))}>
              ›
            </button>
          </div>
          <button
            type="button"
            class="btn small"
            onClick={() => {
              shownMonth.value = monthStartIso(today);
              pickedDay.value = today;
            }}
          >
            Сегодня
          </button>
        </div>

        <div class="kpis">
          <Kpi label="Серия" value={fmtCount(streak.count, WEEKS)} />
          <Kpi label="Тренировок в серии" value={String(streak.workouts)} />
          <Kpi label="За месяц" value={`${inMonth.length} · ${monthMinutes} мин`} />
        </div>

        <div class="cal">
          {DOW.map((d) => (
            <div class="dow" key={d}>
              {d}
            </div>
          ))}
          <div class="dow" />
          {weeks.flatMap((monday, row) => {
            const days = Array.from({ length: 7 }, (_, k) => {
              const iso = addDaysIso(monday, k);
              const list = byDay.get(iso) ?? [];
              const classes = ['day', !iso.startsWith(prefix) && 'out', list.length > 0 && 'has', iso === today && 'today', iso === day && 'sel'];
              const label = fmtDayLong(iso) + (list.length ? `: ${list.map(workoutTitle).join('; ')}` : '');
              return (
                <button
                  type="button"
                  key={iso}
                  class={classes.filter(Boolean).join(' ')}
                  title={label}
                  aria-label={label}
                  aria-pressed={iso === day}
                  onClick={() => pick(iso)}
                >
                  {list.length > 0 && (
                    <span class="fire" aria-hidden="true">
                      🔥
                    </span>
                  )}
                  <span class="num">{parseIso(iso).getDate()}</span>
                  {list.length > 1 && (
                    <span class="count" aria-hidden="true">
                      {list.length}
                    </span>
                  )}
                </button>
              );
            });
            const active = streak.weeks.has(monday);
            const runStart = active && (row === 0 || !streak.weeks.has(addDaysIso(monday, -7)));
            const runEnd = active && (row === weeks.length - 1 || !streak.weeks.has(addDaysIso(monday, 7)));
            const week = (
              <div key={`w${monday}`} class={['wk', active && 'run', runStart && 'first', runEnd && 'last'].filter(Boolean).join(' ')}>
                {streak.end === monday ? (
                  <span class="flame" title={`Серия: ${fmtCount(streak.count, WEEKS)}`}>
                    🔥{streak.count}
                  </span>
                ) : active ? (
                  <span class="chk" title="На этой неделе была тренировка">
                    ✓
                  </span>
                ) : (
                  <span class="ring" />
                )}
              </div>
            );
            return [...days, week];
          })}
        </div>

      </section>

      <DayPanel day={day} today={today} workouts={byDay.get(day) ?? []} />
    </div>
  );
}

function DayPanel({ day, today, workouts }: { day: string; today: string; workouts: readonly Workout[] }) {
  return (
    <section class="box day-panel">
      <h3>{fmtDayLong(day)}</h3>
      {workouts.length ? (
        <>
          <p class="muted">{fmtCount(workouts.length, WORKOUTS)}</p>
          {workouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} />
          ))}
        </>
      ) : (
        <p class="muted">В этот день тренировок нет.</p>
      )}
      <button type="button" class="btn wide" onClick={() => recordWorkout(day)}>
        {day === today ? '+ Записать тренировку' : '+ Добавить тренировку на этот день'}
      </button>
    </section>
  );
}
