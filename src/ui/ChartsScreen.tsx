import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { addDaysIso, fmtDateShort, fmtDayMonth, fmtWeekRange, todayIso } from '../lib/dates';
import { WORKOUTS, fmtCount, fmtNum } from '../lib/format';
import { TYPE_META } from '../model/types';
import {
  EXERCISE_METRICS,
  exerciseCatalog,
  exerciseSeries,
  typeBreakdown,
  weeklyBuckets,
  type ExerciseMetric,
  type WeekBucket,
} from '../stats/aggregate';
import { store } from '../store';
import { BarChart, LineChart } from './charts';
import { EmptyState, Segmented, typeColor } from './components';

type WeekMetric = 'count' | 'minutes' | 'volume';

const WEEK_METRICS: readonly { value: WeekMetric; label: string; format: (n: number) => string }[] = [
  { value: 'count', label: 'Тренировки', format: (n) => fmtCount(n, WORKOUTS) },
  { value: 'minutes', label: 'Минуты', format: (n) => `${fmtNum(n)} мин` },
  { value: 'volume', label: 'Объём', format: (n) => `${fmtNum(n)} кг` },
];

const PERIODS = [
  { value: 12, label: '12 нед' },
  { value: 26, label: '6 мес' },
  { value: 52, label: 'Год' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

const EXERCISE_METRIC_META: Record<ExerciseMetric, { label: string; format: (n: number) => string }> = {
  maxWeight: { label: 'Макс. вес', format: (n) => `${fmtNum(n)} кг` },
  volume: { label: 'Объём', format: (n) => `${fmtNum(n)} кг` },
  reps: { label: 'Повторы', format: (n) => `${fmtNum(n)} повт.` },
  minutes: { label: 'Время', format: (n) => `${fmtNum(n)} мин` },
};

// Chart settings survive switching tabs.
const weekMetric = signal<WeekMetric>('count');
const period = signal<Period>(12);
const exerciseChoice = signal<string | null>(null);
const exerciseMetric = signal<ExerciseMetric>('maxWeight');

export function ChartsScreen() {
  const workouts = store.workouts.value;
  const today = todayIso();
  const buckets = useMemo(() => weeklyBuckets(workouts, period.value, today), [workouts, period.value, today]);
  const catalog = useMemo(() => exerciseCatalog(workouts), [workouts]);

  if (!workouts.length) {
    return (
      <EmptyState>
        <h2>Графиков пока нет</h2>
        <p class="muted">Они появятся после первой записанной тренировки.</p>
      </EmptyState>
    );
  }

  const from = buckets[0]!.start;
  const to = addDaysIso(buckets[buckets.length - 1]!.start, 6);
  const metric = WEEK_METRICS.find((m) => m.value === weekMetric.value)!;

  return (
    <div class="charts">
      <section class="box">
        <div class="section-head">
          <h2>По неделям</h2>
          <Segmented label="Период" value={period.value} options={PERIODS} onChange={(v) => (period.value = v)} />
        </div>
        <Segmented label="Показатель" value={weekMetric.value} options={WEEK_METRICS} onChange={(v) => (weekMetric.value = v)} />
        <BarChart
          data={buckets.map((b: WeekBucket) => ({ label: fmtDayMonth(b.start), title: fmtWeekRange(b.start), value: b[metric.value] }))}
          format={metric.format}
          integer={metric.value === 'count'}
        />
      </section>

      <ExerciseProgress catalog={catalog} />

      <TypesSection from={from} to={to} />
    </div>
  );
}

function ExerciseProgress({ catalog }: { catalog: ReturnType<typeof exerciseCatalog> }) {
  const workouts = store.workouts.value;
  const chosen = catalog.find((c) => c.key === exerciseChoice.value) ?? catalog[0];
  const series = useMemo(() => (chosen ? exerciseSeries(workouts, chosen.key) : []), [workouts, chosen?.key]);

  if (!chosen) {
    return (
      <section class="box">
        <h2>Прогресс упражнения</h2>
        <p class="muted">Добавьте в тренировку упражнение с названием — здесь появится график веса, объёма, повторов или времени.</p>
      </section>
    );
  }

  const available = EXERCISE_METRICS.filter((m) => series.some((p) => p[m] > 0));
  const metric = available.includes(exerciseMetric.value) ? exerciseMetric.value : available[0];
  const points = metric ? series.filter((p) => p[metric] > 0).map((p) => ({ date: p.date, value: p[metric] })) : [];
  const best = points.reduce<(typeof points)[number] | null>((b, p) => (!b || p.value > b.value ? p : b), null);

  return (
    <section class="box">
      <div class="section-head">
        <h2>Прогресс упражнения</h2>
      </div>
      <select
        class="input"
        aria-label="Упражнение"
        value={chosen.key}
        onChange={(e) => (exerciseChoice.value = e.currentTarget.value)}
      >
        {catalog.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name} ({fmtCount(c.sessions, WORKOUTS)})
          </option>
        ))}
      </select>
      {metric ? (
        <>
          <Segmented
            label="Показатель упражнения"
            value={metric}
            options={EXERCISE_METRICS.map((m) => ({ value: m, label: EXERCISE_METRIC_META[m].label, disabled: !available.includes(m) }))}
            onChange={(v) => (exerciseMetric.value = v)}
          />
          <LineChart points={points} format={EXERCISE_METRIC_META[metric].format} />
          {best && (
            <p class="muted">
              Лучший результат: <b>{EXERCISE_METRIC_META[metric].format(best.value)}</b> · {fmtDateShort(best.date)}
            </p>
          )}
        </>
      ) : (
        <p class="muted">У этого упражнения пока нет ни веса, ни повторов, ни времени в подходах.</p>
      )}
    </section>
  );
}

function TypesSection({ from, to }: { from: string; to: string }) {
  const types = typeBreakdown(store.workouts.value, from, to);
  const max = Math.max(1, ...types.map((t) => t.count));
  return (
    <section class="box">
      <h2>По типам</h2>
      <p class="muted">
        {fmtDateShort(from)} – {fmtDateShort(to)}
      </p>
      {types.length === 0 && <p class="muted">За этот период тренировок нет.</p>}
      {types.map((t) => (
        <div class="type-row" key={t.type} style={typeColor(t.type)}>
          <span class="type-name">
            {TYPE_META[t.type].icon} {TYPE_META[t.type].label}
          </span>
          <span class="type-bar">
            <span style={`width:${(t.count / max) * 100}%`} />
          </span>
          <span class="type-val">
            {t.count} · {fmtNum(t.minutes)} мин
          </span>
        </div>
      ))}
    </section>
  );
}
