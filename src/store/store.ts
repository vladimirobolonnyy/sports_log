import { batch, signal } from '@preact/signals';
import { errorText } from '../io/errors';
import { parseProfile, serializeProfile } from '../io/json';
import { newId } from '../model/ids';
import type { Exercise, Workout, WorkoutSet } from '../model/types';

export const STORAGE_KEYS = {
  profile: 'sport-log/profile',
  meta: 'sport-log/meta',
  /** The data as it was right before the last import: lets the user undo an import. */
  beforeImport: 'sport-log/before-import',
} as const;

export interface Meta {
  readonly lastExportAt: number | null;
  readonly lastChangeAt: number | null;
  readonly backupSnoozedUntil: number | null;
  readonly importedAt: number | null;
  readonly installHintDismissed: boolean;
}

const EMPTY_META: Meta = {
  lastExportAt: null,
  lastChangeAt: null,
  backupSnoozedUntil: null,
  importedAt: null,
  installHintDismissed: false,
};

export type WorkoutPatch = Partial<Pick<Workout, 'date' | 'title' | 'type' | 'minutes'>>;
export type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'minutes' | 'distance'>>;
export type ImportMode = 'replace' | 'merge';
/** Puts a deleted item back where it was. */
export type Undo = () => void;

const noop: Undo = () => {};

function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}

/** Imported workouts replace the ones with the same id; new ones are appended. */
export function mergeWorkouts(current: readonly Workout[], incoming: readonly Workout[]): Workout[] {
  const byId = new Map(incoming.map((w) => [w.id, w]));
  const known = new Set(current.map((w) => w.id));
  return [...current.map((w) => byId.get(w.id) ?? w), ...incoming.filter((w) => !known.has(w.id))];
}

/**
 * The whole diary is one JSON document in key-value storage (localStorage in the browser), written synchronously
 * on every change, so nothing is lost if iOS kills the app right after an edit. A few years of workouts take
 * a few hundred kilobytes, far below the storage limit.
 */
export function createStore(storage: Storage, now: () => number = Date.now) {
  const loadError = signal<string | null>(null);
  const saveError = signal<string | null>(null);
  const workouts = signal<readonly Workout[]>(readWorkouts());
  const meta = signal<Meta>(readMeta());
  /** Workouts created in this session, with the date they were created for: see discardIfUntouched. */
  const fresh = new Map<string, string>();

  function readWorkouts(): readonly Workout[] {
    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_KEYS.profile);
    } catch (e) {
      loadError.value = `Хранилище браузера недоступно: ${errorText(e)}`;
      return [];
    }
    if (raw == null) return [];
    try {
      return parseProfile(raw);
    } catch (e) {
      // Never overwrite data we could not read: park it under its own key before the next save.
      const parked = `${STORAGE_KEYS.profile}/unreadable-${now()}`;
      try {
        storage.setItem(parked, raw);
      } catch {
        // Storage is full or gone: the error below is all we can do.
      }
      loadError.value = `Сохранённые данные не читаются (${errorText(e)}). Их копия оставлена в хранилище под ключом «${parked}».`;
      return [];
    }
  }

  function readMeta(): Meta {
    try {
      const raw = storage.getItem(STORAGE_KEYS.meta);
      return raw ? { ...EMPTY_META, ...(JSON.parse(raw) as Partial<Meta>) } : EMPTY_META;
    } catch {
      return EMPTY_META;
    }
  }

  function writeMeta(patch: Partial<Meta>): void {
    meta.value = { ...meta.value, ...patch };
    try {
      storage.setItem(STORAGE_KEYS.meta, JSON.stringify(meta.value));
    } catch {
      // Meta is advisory (backup reminders); a failure here is reported by the profile write anyway.
    }
  }

  function commit(next: readonly Workout[]): void {
    batch(() => {
      workouts.value = next;
      try {
        storage.setItem(STORAGE_KEYS.profile, serializeProfile(next));
        saveError.value = null;
      } catch (e) {
        saveError.value = `Не удалось сохранить изменения (${errorText(e)}). Сохраните резервную копию на вкладке «Данные».`;
      }
      writeMeta({ lastChangeAt: now() });
    });
  }

  const find = (id: string): Workout | undefined => workouts.value.find((w) => w.id === id);

  const mapWorkout = (id: string, fn: (w: Workout) => Workout): void =>
    commit(workouts.value.map((w) => (w.id === id ? fn(w) : w)));

  const mapExercises = (workoutId: string, fn: (list: readonly Exercise[]) => readonly Exercise[]): void =>
    mapWorkout(workoutId, (w) => ({ ...w, exercises: fn(w.exercises) }));

  const mapExercise = (workoutId: string, exerciseId: string, fn: (e: Exercise) => Exercise): void =>
    mapExercises(workoutId, (list) => list.map((e) => (e.id === exerciseId ? fn(e) : e)));

  return {
    workouts,
    meta,
    loadError,
    saveError,
    find,

    /** A new empty workout («создаётся пустая запись»), filled in by the editor. */
    createWorkout(date: string): Workout {
      const w: Workout = { id: newId(), date, title: '', type: 'strength', minutes: null, exercises: [] };
      fresh.set(w.id, date);
      commit([...workouts.value, w]);
      return w;
    },

    updateWorkout(id: string, patch: WorkoutPatch): void {
      mapWorkout(id, (w) => ({ ...w, ...patch }));
    },

    deleteWorkout(id: string): Undo {
      const index = workouts.value.findIndex((w) => w.id === id);
      const removed = workouts.value[index];
      if (!removed) return noop;
      fresh.delete(id);
      commit(workouts.value.filter((w) => w.id !== id));
      return () => {
        if (!find(id)) commit(insertAt(workouts.value, index, removed));
      };
    },

    /**
     * Drops a workout created in this session and left exactly as created, so an accidental tap on
     * «Тренировка» leaves no empty day in the calendar and the streak. Returns whether it was dropped.
     */
    discardIfUntouched(id: string): boolean {
      const createdFor = fresh.get(id);
      fresh.delete(id);
      const w = find(id);
      const untouched =
        w && w.date === createdFor && w.title === '' && w.type === 'strength' && w.minutes === null && w.exercises.length === 0;
      if (untouched) commit(workouts.value.filter((x) => x.id !== id));
      return Boolean(untouched);
    },

    /** Adds an exercise with one empty set ready to be filled in; returns the exercise id. */
    addExercise(workoutId: string): string {
      const exercise: Exercise = { id: newId(), name: '', sets: [{ id: newId(), weight: null, reps: null, minutes: null, distance: null }] };
      mapExercises(workoutId, (list) => [...list, exercise]);
      return exercise.id;
    },

    renameExercise(workoutId: string, exerciseId: string, name: string): void {
      mapExercise(workoutId, exerciseId, (e) => ({ ...e, name }));
    },

    moveExercise(workoutId: string, exerciseId: string, delta: -1 | 1): void {
      mapExercises(workoutId, (list) => {
        const i = list.findIndex((e) => e.id === exerciseId);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= list.length) return list;
        const next = [...list];
        [next[i], next[j]] = [next[j]!, next[i]!];
        return next;
      });
    },

    deleteExercise(workoutId: string, exerciseId: string): Undo {
      const list = find(workoutId)?.exercises ?? [];
      const index = list.findIndex((e) => e.id === exerciseId);
      const removed = list[index];
      if (!removed) return noop;
      mapExercises(workoutId, (l) => l.filter((e) => e.id !== exerciseId));
      return () => {
        const w = find(workoutId);
        if (w && !w.exercises.some((e) => e.id === exerciseId)) mapExercises(workoutId, (l) => insertAt(l, index, removed));
      };
    },

    /** A new set starts as a copy of the previous one: the usual case is «same weight, one more set». */
    addSet(workoutId: string, exerciseId: string): void {
      mapExercise(workoutId, exerciseId, (e) => {
        const last = e.sets[e.sets.length - 1];
        const set: WorkoutSet = {
          id: newId(),
          weight: last?.weight ?? null,
          reps: last?.reps ?? null,
          minutes: last?.minutes ?? null,
          distance: last?.distance ?? null,
        };
        return { ...e, sets: [...e.sets, set] };
      });
    },

    updateSet(workoutId: string, exerciseId: string, setId: string, patch: SetPatch): void {
      mapExercise(workoutId, exerciseId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
    },

    deleteSet(workoutId: string, exerciseId: string, setId: string): Undo {
      const sets = find(workoutId)?.exercises.find((e) => e.id === exerciseId)?.sets ?? [];
      const index = sets.findIndex((s) => s.id === setId);
      const removed = sets[index];
      if (!removed) return noop;
      mapExercise(workoutId, exerciseId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }));
      return () => {
        const e = find(workoutId)?.exercises.find((x) => x.id === exerciseId);
        if (e && !e.sets.some((s) => s.id === setId)) mapExercise(workoutId, exerciseId, (x) => ({ ...x, sets: insertAt(x.sets, index, removed) }));
      };
    },

    /** Replaces or merges the diary with a loaded file; the previous data is kept for undoImport(). */
    importWorkouts(incoming: readonly Workout[], mode: ImportMode): void {
      let backedUp = true;
      try {
        storage.setItem(STORAGE_KEYS.beforeImport, serializeProfile(workouts.value));
      } catch {
        backedUp = false;
      }
      fresh.clear();
      commit(mode === 'replace' ? incoming : mergeWorkouts(workouts.value, incoming));
      writeMeta({ importedAt: backedUp ? now() : null });
    },

    /** Returns the diary to its state right before the last import. */
    undoImport(): boolean {
      const raw = storage.getItem(STORAGE_KEYS.beforeImport);
      if (raw == null) return false;
      commit(parseProfile(raw));
      storage.removeItem(STORAGE_KEYS.beforeImport);
      writeMeta({ importedAt: null });
      return true;
    },

    markExported(): void {
      writeMeta({ lastExportAt: now(), backupSnoozedUntil: null });
    },

    snoozeBackupReminder(days: number): void {
      writeMeta({ backupSnoozedUntil: now() + days * 86_400_000 });
    },

    dismissInstallHint(): void {
      writeMeta({ installHintDismissed: true });
    },

    /** Another tab changed the data: take its version instead of overwriting it with ours on the next edit. */
    reload(): void {
      batch(() => {
        workouts.value = readWorkouts();
        meta.value = readMeta();
      });
    },
  };
}

export type Store = ReturnType<typeof createStore>;
