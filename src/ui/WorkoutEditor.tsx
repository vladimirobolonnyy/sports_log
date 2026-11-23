import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmtDayLong, isValidIso } from '../lib/dates';
import { fmtNum } from '../lib/format';
import { exerciseSummary, setsMinutes, workoutSummary } from '../model/derive';
import { TYPE_META, WORKOUT_TYPES, isWorkoutType, type Exercise, type Workout } from '../model/types';
import { closeWorkout } from '../router';
import { exerciseCatalog } from '../stats/aggregate';
import { store } from '../store';
import { EmptyState, NumberInput, SuggestInput } from './components';
import { showToast } from './toast';

/** Distinct non-empty titles, most recent first. */
function recentTitles(workouts: readonly Workout[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = workouts.length - 1; i >= 0; i--) {
    const t = workouts[i]!.title.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

/** «Записать тренировку»: every change is saved immediately, there is no «Save» button. */
export function WorkoutEditor({ id }: { id: string }) {
  const all = store.workouts.value;
  const workout = all.find((w) => w.id === id);
  const [focusExercise, setFocusExercise] = useState<string | null>(null);
  const titles = useMemo(() => recentTitles(all), [all]);
  const names = useMemo(() => exerciseCatalog(all).map((e) => e.name), [all]);
  useEffect(() => () => void store.discardIfUntouched(id), [id]);

  if (!workout) {
    return (
      <EmptyState>
        <p>Тренировка не найдена — возможно, её удалили.</p>
        <button type="button" class="btn" onClick={closeWorkout}>
          К календарю
        </button>
      </EmptyState>
    );
  }

  const remove = () => {
    const undo = store.deleteWorkout(id);
    closeWorkout();
    showToast('Тренировка удалена', { label: 'Вернуть', run: undo });
  };
  const fromSets = setsMinutes(workout);

  return (
    <div class="editor">
      <div class="ed-head">
        <button type="button" class="icon-btn" aria-label="Назад" onClick={closeWorkout}>
          ‹
        </button>
        <h2>{fmtDayLong(workout.date)}</h2>
        <button type="button" class="btn small danger" onClick={remove}>
          Удалить
        </button>
      </div>

      <section class="box ed-main">
        <div class="field">
          <span class="label">Название тренировки</span>
          <SuggestInput
            value={workout.title}
            label="Название тренировки"
            placeholder={`${TYPE_META[workout.type].label}, или например «Грудь + спина»`}
            suggestions={titles}
            onChange={(title) => store.updateWorkout(id, { title })}
          />
        </div>
        <div class="ed-grid">
          <label class="field">
            <span class="label">Дата</span>
            <input
              class="input"
              type="date"
              value={workout.date}
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (isValidIso(v)) store.updateWorkout(id, { date: v });
              }}
            />
          </label>
          <label class="field">
            <span class="label">Тип</span>
            <select
              class="input"
              value={workout.type}
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (isWorkoutType(v)) store.updateWorkout(id, { type: v });
              }}
            >
              {WORKOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].icon} {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="label">Длительность, мин</span>
            <NumberInput
              value={workout.minutes}
              integer
              label="Длительность, мин"
              placeholder={fromSets ? `${fmtNum(fromSets)} по подходам` : 'не указана'}
              onChange={(minutes) => store.updateWorkout(id, { minutes })}
            />
          </label>
        </div>
      </section>

      <h3 class="section-title">Упражнения</h3>
      {workout.exercises.length === 0 && (
        <p class="muted">Добавьте упражнение — внутри него записываются подходы: вес, повторы, время, дистанция.</p>
      )}
      {workout.exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.id}
          workoutId={id}
          exercise={ex}
          index={i}
          count={workout.exercises.length}
          names={names}
          autoFocus={ex.id === focusExercise}
        />
      ))}
      <button type="button" class="btn wide" onClick={() => setFocusExercise(store.addExercise(id))}>
        + Добавить упражнение
      </button>
      <p class="muted ed-total">Итого: {workoutSummary(workout)}</p>
    </div>
  );
}

function ExerciseCard(props: {
  workoutId: string;
  exercise: Exercise;
  index: number;
  count: number;
  names: readonly string[];
  autoFocus: boolean;
}) {
  const { workoutId: wid, exercise, index, count, names, autoFocus } = props;
  const eid = exercise.id;

  const removeExercise = () => {
    const undo = store.deleteExercise(wid, eid);
    showToast(exercise.name.trim() ? `Упражнение «${exercise.name.trim()}» удалено` : 'Упражнение удалено', { label: 'Вернуть', run: undo });
  };
  const removeSet = (setId: string, n: number) => {
    const undo = store.deleteSet(wid, eid, setId);
    showToast(`Подход ${n} удалён`, { label: 'Вернуть', run: undo });
  };

  return (
    <section class="box ex-card" aria-label={`Упражнение ${index + 1}`}>
      <div class="ex-head">
        <SuggestInput
          value={exercise.name}
          label={`Название упражнения ${index + 1}`}
          placeholder="Название упражнения"
          suggestions={names}
          autoFocus={autoFocus}
          onChange={(name) => store.renameExercise(wid, eid, name)}
        />
        <button type="button" class="icon-btn danger" aria-label="Удалить упражнение" onClick={removeExercise}>
          ✕
        </button>
      </div>
      <p class="ex-sum muted">{exerciseSummary(exercise)}</p>

      {exercise.sets.length > 0 && (
        <div class="sets">
          <div class="set-row set-hd" aria-hidden="true">
            <span>№</span>
            <span>Вес, кг</span>
            <span>Повторы</span>
            <span>Мин</span>
            <span>Км</span>
            <span />
          </div>
          {exercise.sets.map((s, i) => (
            <div class="set-row" key={s.id}>
              <span class="set-no">{i + 1}</span>
              <NumberInput value={s.weight} label={`Вес, кг, подход ${i + 1}`} onChange={(weight) => store.updateSet(wid, eid, s.id, { weight })} />
              <NumberInput value={s.reps} integer label={`Повторы, подход ${i + 1}`} onChange={(reps) => store.updateSet(wid, eid, s.id, { reps })} />
              <NumberInput value={s.minutes} label={`Минуты, подход ${i + 1}`} onChange={(minutes) => store.updateSet(wid, eid, s.id, { minutes })} />
              <NumberInput value={s.distance} label={`Км, подход ${i + 1}`} onChange={(distance) => store.updateSet(wid, eid, s.id, { distance })} />
              <button type="button" class="icon-btn ghost" aria-label={`Удалить подход ${i + 1}`} onClick={() => removeSet(s.id, i + 1)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div class="ex-foot">
        <button type="button" class="btn small" onClick={() => store.addSet(wid, eid)}>
          + Подход
        </button>
        <div class="ex-tools">
          <button type="button" class="icon-btn" disabled={index === 0} aria-label="Переместить выше" onClick={() => store.moveExercise(wid, eid, -1)}>
            ↑
          </button>
          <button type="button" class="icon-btn" disabled={index === count - 1} aria-label="Переместить ниже" onClick={() => store.moveExercise(wid, eid, 1)}>
            ↓
          </button>
        </div>
      </div>
    </section>
  );
}
