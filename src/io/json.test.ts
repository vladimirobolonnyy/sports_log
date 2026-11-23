import { describe, expect, it } from 'vitest';
import { exercise, set, workout } from '../test/fixtures';
import { DataError } from './errors';
import { FORMAT, VERSION, parseProfile, serializeProfile } from './json';

describe('profile JSON', () => {
  const sample = [
    workout('2026-11-20', {
      id: 'w1',
      title: 'Грудь',
      minutes: 45,
      exercises: [exercise('Разминка', [set(null, null, 9.5, 1.6)]), exercise('Жим', [set(60, 10), set(62.5, 8, 1)])],
    }),
    workout('2026-11-21', { id: 'w2', minutes: 30 }),
  ];

  it('round-trips without losing anything', () => {
    const text = serializeProfile(sample, { pretty: true, exportedAt: '2026-11-23T10:00:00.000Z' });
    expect(JSON.parse(text)).toMatchObject({ format: FORMAT, version: VERSION, exportedAt: '2026-11-23T10:00:00.000Z' });
    expect(parseProfile(text)).toEqual(sample);
  });

  it('reads version 1 files, which have no distance', () => {
    const v1 = JSON.stringify({
      format: FORMAT,
      version: 1,
      workouts: [{ id: 'w1', date: '2026-11-20', title: '', type: 'strength', minutes: null, exercises: [{ id: 'e1', name: 'Жим', sets: [{ id: 's1', weight: 60, reps: 10, minutes: null }] }] }],
    });
    const [w] = parseProfile(v1);
    expect(w!.exercises[0]!.sets[0]).toEqual({ id: 's1', weight: 60, reps: 10, minutes: null, distance: null });
    expect(w).not.toHaveProperty('type'); // workout types were dropped later
  });

  it('accepts a BOM and a bare array of workouts', () => {
    expect(parseProfile(`﻿${serializeProfile(sample)}`)).toEqual(sample);
    expect(parseProfile(JSON.stringify(sample))).toEqual(sample);
  });

  it('fills in what a hand-written file may omit', () => {
    const [w] = parseProfile(JSON.stringify({ workouts: [{ date: '2026-11-20', exercises: [{ name: 'Бег', sets: [{ minutes: 20 }] }] }] }));
    expect(w).toMatchObject({ date: '2026-11-20', title: '', minutes: null });
    expect(w!.id).toMatch(/\S/);
    expect(w!.exercises[0]!.sets[0]).toMatchObject({ weight: null, reps: null, minutes: 20 });
  });

  it('gives repeated workout ids new ones', () => {
    const list = parseProfile(JSON.stringify([workout('2026-11-20', { id: 'x' }), workout('2026-11-21', { id: 'x' })]));
    expect(list[0]!.id).toBe('x');
    expect(list[1]!.id).not.toBe('x');
  });

  it('rejects files it cannot trust, saying why', () => {
    expect(() => parseProfile('не json')).toThrow(DataError);
    expect(() => parseProfile('{"format":"owlrandom-sport","videos":[]}')).toThrow(/другого приложения/);
    expect(() => parseProfile(JSON.stringify({ format: FORMAT, version: VERSION + 1, workouts: [] }))).toThrow(/более новой версией/);
    expect(() => parseProfile('{"format":"sport-log"}')).toThrow(/нет списка тренировок/);
    expect(() => parseProfile('[{"date":"2026-02-30"}]')).toThrow(/Тренировка №1: неверная дата/);
    expect(() => parseProfile('[{"date":"2026-11-20","exercises":[{"sets":[{"weight":-1}]}]}]')).toThrow(
      /Тренировка №1, упражнение №1, подход №1, вес/,
    );
    expect(() => parseProfile('[{"date":"2026-11-20","title":5}]')).toThrow(/название: ожидалась строка/);
  });
});
