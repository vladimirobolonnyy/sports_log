import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { fmtMonthTitle } from '../lib/dates';
import { WORKOUTS, fmtCount } from '../lib/format';
import { exerciseKey, workoutTitle } from '../model/derive';
import type { Workout } from '../model/types';
import { store } from '../store';
import { EmptyState, WorkoutRow } from './components';

const query = signal('');

/** Newest first; workouts of one day in the order they were recorded, latest on top. */
function newestFirst(workouts: readonly Workout[]): Workout[] {
  return workouts
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w.date.localeCompare(a.w.date) || b.i - a.i)
    .map((x) => x.w);
}

export function JournalScreen() {
  const workouts = store.workouts.value;
  const q = exerciseKey(query.value);
  const sorted = useMemo(() => newestFirst(workouts), [workouts]);
  const shown = q
    ? sorted.filter((w) => exerciseKey([workoutTitle(w), ...w.exercises.map((e) => e.name)].join(' ')).includes(q))
    : sorted;

  const months: { key: string; items: Workout[] }[] = [];
  for (const w of shown) {
    const key = w.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(w);
    else months.push({ key, items: [w] });
  }

  if (!workouts.length) {
    return (
      <EmptyState>
        <h2>Журнал пуст</h2>
        <p class="muted">Нажмите «+ Тренировка», чтобы записать первую.</p>
      </EmptyState>
    );
  }

  return (
    <div class="journal">
      <input
        class="input search"
        type="search"
        placeholder="Поиск по названию или упражнению"
        aria-label="Поиск"
        value={query.value}
        onInput={(e) => (query.value = e.currentTarget.value)}
      />
      {months.length === 0 && <p class="muted">Ничего не найдено.</p>}
      {months.map((m) => (
        <section class="box month-group" key={m.key}>
          <h3>
            {fmtMonthTitle(`${m.key}-01`)} <span class="muted">· {fmtCount(m.items.length, WORKOUTS)}</span>
          </h3>
          {m.items.map((w) => (
            <WorkoutRow key={w.id} workout={w} withDate />
          ))}
        </section>
      ))}
    </div>
  );
}
