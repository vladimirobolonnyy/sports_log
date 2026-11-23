import { describe, expect, it } from 'vitest';
import { exerciseKey, workoutMinutes, workoutSummary, workoutVolume } from '../model/derive';
import { exercise, set, workout } from '../test/fixtures';
import { exerciseCatalog, exerciseSeries, typeBreakdown, weeklyBuckets } from './aggregate';
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

describe('weeklyBuckets', () => {
  it('returns the last N weeks, oldest first, the current one included', () => {
    const list = [
      workout('2026-11-24', { minutes: 30, exercises: [exercise('Жим', [set(50, 10)])] }),
      workout('2026-11-23', { minutes: 20 }),
      workout('2026-11-11', { minutes: 40 }),
      workout('2026-01-01', { minutes: 99 }), // outside the range
    ];
    const b = weeklyBuckets(list, 3, TODAY);
    expect(b.map((x) => x.start)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(b.map((x) => [x.count, x.minutes, x.volume])).toEqual([
      [1, 40, 0],
      [0, 0, 0],
      [2, 50, 500],
    ]);
  });
});

describe('typeBreakdown', () => {
  it('counts workouts per type within the period, most frequent first', () => {
    const list = [
      workout('2026-11-20', { type: 'yoga', minutes: 30 }),
      workout('2026-11-21', { type: 'strength', minutes: 60 }),
      workout('2026-11-22', { type: 'strength', minutes: 45 }),
      workout('2026-10-01', { type: 'cardio', minutes: 20 }),
    ];
    expect(typeBreakdown(list, '2026-11-01', '2026-11-30')).toEqual([
      { type: 'strength', count: 2, minutes: 105 },
      { type: 'yoga', count: 1, minutes: 30 },
    ]);
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

  it('makes one point per workout, oldest first, combining repeated entries', () => {
    expect(exerciseSeries(list, 'жим лежа').map((p) => [p.date, p.maxWeight, p.volume, p.reps])).toEqual([
      ['2026-11-03', 55, 550, 10],
      ['2026-11-10', 65, 1120, 18],
      ['2026-11-17', 70, 1150, 25],
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
