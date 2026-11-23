import { describe, expect, it } from 'vitest';
import { exerciseKey, workoutMinutes, workoutSummary, workoutVolume } from '../model/derive';
import { exercise, set, workout } from '../test/fixtures';
import { exerciseCatalog, exerciseSeries } from './aggregate';
import { niceDomain, ticksOf } from './scale';
import { streakInfo } from './streak';

const TODAY = '2026-11-25'; // Wednesday; its week starts on 2026-11-23

describe('streakInfo', () => {
  it('is empty without workouts', () => {
    expect(streakInfo([], TODAY)).toMatchObject({ count: 0, workouts: 0, end: null });
  });

  it('counts weeks in a row back from the current week', () => {
    const s = streakInfo(['2026-11-24', '2026-11-17', '2026-11-18', '2026-11-10', '2026-10-20'], TODAY);
    expect(s).toMatchObject({ count: 3, workouts: 4, end: '2026-11-23' });
    expect(s.weeks.get('2026-11-16')).toBe(2);
  });

  it('is not broken by a current week that has no workout yet', () => {
    expect(streakInfo(['2026-11-20', '2026-11-12'], TODAY)).toMatchObject({ count: 2, workouts: 2, end: '2026-11-16' });
  });

  it('is broken by a past week without workouts', () => {
    expect(streakInfo(['2026-11-05'], TODAY)).toMatchObject({ count: 0, end: null });
  });
});

describe('derived values', () => {
  const w = workout(TODAY, { exercises: [exercise('Жим', [set(60, 10), set(70, 8)]), exercise('Планка', [set(null, null, 1.5), set(null, null, 2)])] });

  it('computes tonnage and minutes', () => {
    expect(workoutVolume(w)).toBe(60 * 10 + 70 * 8);
    expect(workoutMinutes(w)).toBe(4); // 3.5 rounded: no explicit duration, so the sets' time counts
    expect(workoutMinutes({ ...w, minutes: 50 })).toBe(50);
  });

  it('summarises a workout', () => {
    // Thousands are grouped with a no-break space, so «1 160» never wraps.
    expect(workoutSummary(w)).toBe('2 упражнения · 4 подхода · 1 160 кг · 4 мин');
    expect(workoutSummary(workout(TODAY))).toBe('пока пусто');
  });

  it('treats differently spelled names as one exercise', () => {
    expect(exerciseKey(' Жим  Лёжа ')).toBe(exerciseKey('жим лежа'));
  });
});

describe('exercise progress', () => {
  const list = [
    workout('2026-11-10', { exercises: [exercise('Жим лёжа', [set(60, 10), set(65, 8)])] }),
    workout('2026-11-03', { exercises: [exercise('жим лежа', [set(55, 10)]), exercise('Присед', [set(80, 5)])] }),
    workout('2026-11-17', { exercises: [exercise('Жим лёжа', [set(70, 5)]), exercise('Жим лёжа', [set(40, 20)])] }),
    workout('2026-11-18', { exercises: [exercise('', [set(1, 1)])] }),
  ];

  it('lists exercises by how often they were done, under their latest name', () => {
    expect(exerciseCatalog(list)).toEqual([
      { key: 'жим лежа', name: 'Жим лёжа', sessions: 3 },
      { key: 'присед', name: 'Присед', sessions: 1 },
    ]);
  });

  it('makes one point per workout, oldest first: heaviest set, total reps, minutes and km', () => {
    expect(exerciseSeries(list, 'жим лежа').map((p) => [p.date, p.weight, p.reps, p.minutes, p.distance])).toEqual([
      ['2026-11-03', 55, 10, 0, 0],
      ['2026-11-10', 65, 18, 0, 0],
      ['2026-11-17', 70, 25, 0, 0],
    ]);
    const warmUps = [
      workout('2026-11-03', { exercises: [exercise('Разминка', [set(null, null, 9, 1.5)])] }),
      workout('2026-11-12', { exercises: [exercise('Разминка', [set(null, null, 8, 1.5), set(null, null, 2, 0.3)])] }),
    ];
    expect(exerciseSeries(warmUps, 'разминка').map((p) => [p.minutes, p.distance])).toEqual([
      [9, 1.5],
      [10, 1.8],
    ]);
  });
});

describe('niceDomain', () => {
  it('rounds the axis to friendly ticks', () => {
    expect(niceDomain(0, 1160)).toEqual({ lo: 0, hi: 1500, step: 500 });
    expect(ticksOf(niceDomain(0, 7, 4, true))).toEqual([0, 2, 4, 6, 8]);
    expect(ticksOf(niceDomain(0, 3, 4, true))).toEqual([0, 1, 2, 3]);
    expect(niceDomain(0, 0, 4, true)).toEqual({ lo: 0, hi: 1, step: 1 });
    expect(ticksOf(niceDomain(52, 71))).toEqual([50, 55, 60, 65, 70, 75]);
  });
});
