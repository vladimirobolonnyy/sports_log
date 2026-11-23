import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { fmtDayMonth } from '../lib/dates';
import { WORKOUTS, fmtCount, fmtNum } from '../lib/format';
import { EXERCISE_METRICS, exerciseCatalog, exerciseSeries, type ExerciseMetric } from '../stats/aggregate';
import { store } from '../store';
import { LineChart, type Point } from './charts';
import { EmptyState, Segmented } from './components';

const METRICS: Record<ExerciseMetric, { label: string; hint: string; format: (n: number) => string }> = {
  weight: { label: 'Вес', hint: 'Самый тяжёлый подход за тренировку', format: (n) => `${fmtNum(n)} кг` },
  reps: { label: 'Повторы', hint: 'Сумма повторов за тренировку', format: (n) => `${fmtNum(n)} повт.` },
  minutes: { label: 'Мин', hint: 'Сумма минут за тренировку', format: (n) => `${fmtNum(n)} мин` },
  distance: { label: 'Км', hint: 'Сумма километров за тренировку', format: (n) => `${fmtNum(n)} км` },
};

const METRIC_OPTIONS = EXERCISE_METRICS.map((m) => ({ value: m, label: METRICS[m].label }));

// Survives switching tabs.
const metric = signal<ExerciseMetric>('weight');

/** One chart per exercise for the chosen metric; a point is a workout. */
export function ChartsScreen() {
  const workouts = store.workouts.value;
  const series = useMemo(
    () => exerciseCatalog(workouts).map((entry) => ({ entry, points: exerciseSeries(workouts, entry.key) })),
    [workouts],
  );

  if (!series.length) {
    return (
      <EmptyState>
        <h2>Графиков пока нет</h2>
        <p class="muted">Они появятся, когда в тренировках будут упражнения с названиями.</p>
      </EmptyState>
    );
  }

  const m = metric.value;
  const meta = METRICS[m];
  const charted = series
    .map((s) => ({ ...s, values: s.points.filter((p) => p[m] > 0).map((p) => ({ date: p.date, value: p[m] })) }))
    .filter((s) => s.values.length > 0);
  const without = series.filter((s) => !s.points.some((p) => p[m] > 0)).map((s) => s.entry.name);

  return (
    <div class="charts">
      <div class="charts-head">
        <Segmented label="Показатель" value={m} options={METRIC_OPTIONS} onChange={(v) => (metric.value = v)} />
        <p class="muted">{meta.hint}. Нажмите на точку, чтобы увидеть значение.</p>
      </div>
      {charted.length === 0 && <p class="muted">Ни у одного упражнения нет данных «{meta.label}».</p>}
      <div class="chart-grid">
        {charted.map((s) => (
          <ExerciseChart key={s.entry.key} name={s.entry.name} points={s.values} format={meta.format} />
        ))}
      </div>
      {without.length > 0 && (
        <p class="muted">
          Без данных «{meta.label}»: {without.join(', ')}.
        </p>
      )}
    </div>
  );
}

function ExerciseChart({ name, points, format }: { name: string; points: readonly Point[]; format: (n: number) => string }) {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const diff = last.value - first.value;
  const change = diff === 0 ? 'без изменений' : `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))}`;
  return (
    <section class="box ex-chart" aria-label={name}>
      <h3>{name}</h3>
      <p class="muted ex-chart-sub">
        {fmtCount(points.length, WORKOUTS)}
        {points.length > 1 && ` · с ${fmtDayMonth(first.date)}: ${format(first.value)} → ${format(last.value)} (${change})`}
      </p>
      <LineChart points={points} format={format} height={160} />
    </section>
  );
}
