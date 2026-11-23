import { beforeEach, describe, expect, it } from 'vitest';
import { serializeProfile } from '../io/json';
import { workout } from '../test/fixtures';
import { backupReminder } from './backup';
import { MemoryStorage } from './memoryStorage';
import { STORAGE_KEYS, createStore, mergeWorkouts, type Meta } from './store';

const DAY = 86_400_000;

describe('store', () => {
  let storage: MemoryStorage;
  let clock: number;
  const open = () => createStore(storage, () => clock);

  beforeEach(() => {
    storage = new MemoryStorage();
    clock = Date.UTC(2026, 10, 23);
  });

  it('records a workout with exercises and sets and keeps it across restarts', () => {
    const store = open();
    const w = store.createWorkout('2026-11-23');
    store.updateWorkout(w.id, { title: 'Грудь', minutes: 50 });
    const ex = store.addExercise(w.id);
    store.renameExercise(w.id, ex, 'Жим лёжа');
    const firstSet = store.find(w.id)!.exercises[0]!.sets[0]!;
    store.updateSet(w.id, ex, firstSet.id, { weight: 60, reps: 10 });
    store.addSet(w.id, ex); // copies the previous set
    store.addSet(w.id, ex);

    const reopened = open().find(w.id)!;
    expect(reopened).toMatchObject({ title: 'Грудь', minutes: 50 });
    expect(reopened.exercises[0]!.name).toBe('Жим лёжа');
    expect(reopened.exercises[0]!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [60, 10],
      [60, 10],
      [60, 10],
    ]);
    expect(open().meta.value.lastChangeAt).toBe(clock);
  });

  it('starts an exercise with one empty set', () => {
    const store = open();
    const w = store.createWorkout('2026-11-23');
    store.addExercise(w.id);
    expect(store.find(w.id)!.exercises[0]!.sets).toEqual([expect.objectContaining({ weight: null, reps: null, minutes: null })]);
  });

  it('moves exercises and ignores moves past the ends', () => {
    const store = open();
    const w = store.createWorkout('2026-11-23');
    const a = store.addExercise(w.id);
    const b = store.addExercise(w.id);
    store.moveExercise(w.id, b, -1);
    store.moveExercise(w.id, b, -1);
    expect(store.find(w.id)!.exercises.map((e) => e.id)).toEqual([b, a]);
  });

  it('undoes deletions in place', () => {
    const store = open();
    const w1 = store.createWorkout('2026-11-21');
    const w2 = store.createWorkout('2026-11-22');
    const ex = store.addExercise(w2.id);
    store.addSet(w2.id, ex);
    const sets = store.find(w2.id)!.exercises[0]!.sets;

    store.deleteSet(w2.id, ex, sets[0]!.id)();
    expect(store.find(w2.id)!.exercises[0]!.sets.map((s) => s.id)).toEqual(sets.map((s) => s.id));

    store.deleteExercise(w2.id, ex)();
    expect(store.find(w2.id)!.exercises).toHaveLength(1);

    const undo = store.deleteWorkout(w1.id);
    expect(store.find(w1.id)).toBeUndefined();
    undo();
    undo(); // a second undo must not duplicate it
    expect(store.workouts.value.map((w) => w.id)).toEqual([w1.id, w2.id]);
  });

  it('drops a workout left exactly as created, and only that', () => {
    const store = open();
    const untouched = store.createWorkout('2026-11-23');
    const typed = store.createWorkout('2026-11-23');
    store.updateWorkout(typed.id, { title: 'Йога' });
    expect(store.discardIfUntouched(untouched.id)).toBe(true);
    expect(store.discardIfUntouched(typed.id)).toBe(false);
    expect(store.workouts.value.map((w) => w.id)).toEqual([typed.id]);
    // A workout from an earlier session is never dropped, even if empty.
    const old = open();
    expect(old.discardIfUntouched(typed.id)).toBe(false);
  });

  it('imports by replacing or merging, and can undo the import', () => {
    const store = open();
    const mine = store.createWorkout('2026-11-01');
    store.updateWorkout(mine.id, { title: 'Моя' });
    const incoming = [workout('2026-11-02', { id: 'f1' }), { ...store.find(mine.id)!, title: 'Из файла' }];

    store.importWorkouts(incoming, 'merge');
    expect(store.workouts.value.map((w) => [w.id, w.title])).toEqual([
      [mine.id, 'Из файла'],
      ['f1', ''],
    ]);
    expect(store.meta.value.importedAt).toBe(clock);

    store.importWorkouts([workout('2026-11-03', { id: 'f2' })], 'replace');
    expect(store.workouts.value.map((w) => w.id)).toEqual(['f2']);

    expect(store.undoImport()).toBe(true);
    expect(store.workouts.value.map((w) => w.id)).toEqual([mine.id, 'f1']);
    expect(store.meta.value.importedAt).toBeNull();
    expect(store.undoImport()).toBe(false);
  });

  it('never overwrites stored data it cannot read', () => {
    storage.setItem(STORAGE_KEYS.profile, '{broken');
    const store = open();
    expect(store.workouts.value).toEqual([]);
    expect(store.loadError.value).toMatch(/не читаются/);
    const parked = `${STORAGE_KEYS.profile}/unreadable-${clock}`;
    expect(storage.getItem(parked)).toBe('{broken');
    store.createWorkout('2026-11-23');
    expect(storage.getItem(parked)).toBe('{broken');
  });

  it('reports a failed save instead of losing the edit silently', () => {
    const store = open();
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    store.createWorkout('2026-11-23');
    expect(store.workouts.value).toHaveLength(1);
    expect(store.saveError.value).toMatch(/Не удалось сохранить/);
  });

  it('reloads data changed by another tab', () => {
    const store = open();
    storage.setItem(STORAGE_KEYS.profile, serializeProfile([workout('2026-11-20', { id: 'other-tab' })]));
    store.reload();
    expect(store.workouts.value.map((w) => w.id)).toEqual(['other-tab']);
  });
});

describe('mergeWorkouts', () => {
  it('replaces by id and appends new ones, keeping the order', () => {
    const a = workout('2026-11-01', { id: 'a' });
    const b = workout('2026-11-02', { id: 'b' });
    const b2 = { ...b, title: 'new' };
    const c = workout('2026-11-03', { id: 'c' });
    expect(mergeWorkouts([a, b], [c, b2])).toEqual([a, b2, c]);
  });
});

describe('backupReminder', () => {
  const now = Date.UTC(2026, 10, 23);
  const meta = (m: Partial<Meta>): Meta => ({
    lastExportAt: null,
    lastChangeAt: null,
    backupSnoozedUntil: null,
    importedAt: null,
    installHintDismissed: false,
    ...m,
  });

  it('waits for a few workouts before the first backup', () => {
    expect(backupReminder(meta({}), 0, now)).toBeNull();
    expect(backupReminder(meta({}), 2, now)).toBeNull();
    expect(backupReminder(meta({}), 3, now)).toMatch(/ещё нет/);
  });

  it('reminds when the backup is old and there are newer changes', () => {
    expect(backupReminder(meta({ lastExportAt: now - 20 * DAY, lastChangeAt: now - DAY }), 5, now)).toMatch(/20 дней назад/);
    expect(backupReminder(meta({ lastExportAt: now - 20 * DAY, lastChangeAt: now - 30 * DAY }), 5, now)).toBeNull();
    expect(backupReminder(meta({ lastExportAt: now - 5 * DAY, lastChangeAt: now }), 5, now)).toBeNull();
  });

  it('stays quiet while snoozed', () => {
    expect(backupReminder(meta({ backupSnoozedUntil: now + DAY }), 5, now)).toBeNull();
  });
});
