import { describe, expect, it } from 'vitest';
import { exercise, set, workout } from '../test/fixtures';
import { workoutsToCsv } from './csv';
import { parseProfileFile, summarize } from './files';
import { serializeProfile } from './json';

describe('parseProfileFile', () => {
  const sample = [workout('2026-11-20', { id: 'w1', exercises: [exercise('Жим', [set(60, 10)])] })];

  it('picks the reader by extension, or by content when the extension is unknown', () => {
    expect(parseProfileFile('backup.json', serializeProfile(sample))).toHaveLength(1);
    expect(parseProfileFile('backup.csv', workoutsToCsv(sample))).toHaveLength(1);
    expect(parseProfileFile('backup', serializeProfile(sample))).toHaveLength(1);
    expect(parseProfileFile('backup.txt', workoutsToCsv(sample))).toHaveLength(1);
  });
});

describe('summarize', () => {
  it('counts workouts, exercises, sets and the date range', () => {
    const s = summarize([
      workout('2026-11-21', { exercises: [exercise('А', [set(1, 1), set(1, 1)]), exercise('Б')] }),
      workout('2026-10-02'),
    ]);
    expect(s).toEqual({ workouts: 2, exercises: 2, sets: 2, from: '2026-10-02', to: '2026-11-21' });
    expect(summarize([])).toEqual({ workouts: 0, exercises: 0, sets: 0, from: null, to: null });
  });
});
