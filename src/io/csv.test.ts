import { describe, expect, it } from 'vitest';
import { exercise, set, withoutIds, workout } from '../test/fixtures';
import { csvToWorkouts, parseCsvRows, workoutsToCsv } from './csv';
import { DataError } from './errors';

const HEADER = 'Дата;Тренировка;Длительность, мин;Упражнение;Подход;Вес, кг;Повторы;Время, мин;Дистанция, км;ID тренировки';

describe('workoutsToCsv', () => {
  it('writes one row per set with a BOM, «;» and decimal commas', () => {
    const csv = workoutsToCsv([
      workout('2026-11-20', {
        id: 'w1',
        title: 'Грудь',
        minutes: 50,
        exercises: [
          exercise('Разминка', [set(null, null, 9.5, 1.6)]),
          exercise('Жим лёжа', [set(62.5, 10), set(70, 8)]),
          exercise('Планка', [set(null, null, 1.5)]),
        ],
      }),
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      HEADER,
      '2026-11-20;Грудь;50;Разминка;1;;;9,5;1,6;w1',
      '2026-11-20;Грудь;50;Жим лёжа;1;62,5;10;;;w1',
      '2026-11-20;Грудь;50;Жим лёжа;2;70;8;;;w1',
      '2026-11-20;Грудь;50;Планка;1;;;1,5;;w1',
      '',
    ]);
  });

  it('reads CSV of earlier versions: with a «Тип» column and without «Дистанция, км»', () => {
    const old = ['Дата;Тренировка;Тип;Длительность, мин;Упражнение;Подход;Вес, кг;Повторы;Время, мин;ID тренировки', '2026-11-20;;strength;;Жим;1;60;10;;w1'].join('\r\n');
    expect(csvToWorkouts(old)[0]!.exercises[0]!.sets[0]).toMatchObject({ weight: 60, reps: 10, distance: null });
  });

  it('quotes text with delimiters, quotes and line breaks', () => {
    const csv = workoutsToCsv([workout('2026-11-20', { id: 'w1', title: 'Ноги; "тяжёлый" день\nвторой' })]);
    expect(csv).toContain('"Ноги; ""тяжёлый"" день\nвторой"');
  });

  it('writes a row for a workout without exercises and an exercise without sets', () => {
    const csv = workoutsToCsv([workout('2026-11-20', { id: 'w1' }), workout('2026-11-21', { id: 'w2', exercises: [exercise('Бег')] })]);
    expect(csv.slice(1).split('\r\n').slice(1, 3)).toEqual(['2026-11-20;;;;;;;;;w1', '2026-11-21;;;Бег;;;;;;w2']);
  });
});

describe('csvToWorkouts', () => {
  it('reads back exactly what it wrote', () => {
    const original = [
      workout('2026-11-20', {
        id: 'w1',
        title: 'Грудь; "тяжёлая"',
        minutes: 50,
        exercises: [exercise('Жим лёжа', [set(62.5, 10), set(70, 8), set(null, null)]), exercise('Пустое упражнение')],
      }),
      workout('2026-11-21', { id: 'w2', minutes: 30 }),
      workout('2026-11-22', { id: 'w3', exercises: [exercise('Бег', [set(null, null, 25, 5.2)])] }),
    ];
    const back = csvToWorkouts(workoutsToCsv(original));
    expect(back.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(withoutIds(back)).toEqual(withoutIds(original));
  });

  it('keeps two entries of the same exercise apart when set numbers start over', () => {
    const csv = [HEADER, '2026-11-20;;;Жим;1;60;10;;;w1', '2026-11-20;;;Жим;2;60;10;;;w1', '2026-11-20;;;Жим;1;40;15;;;w1'].join('\n');
    const [w] = csvToWorkouts(csv);
    expect(w!.exercises.map((e) => e.sets.length)).toEqual([2, 1]);
  });

  it('groups hand-written rows without ids by date and title', () => {
    const csv = [
      'Дата;Тренировка;Упражнение;Вес, кг;Повторы',
      '2026-11-20;Спина;Тяга;50;10',
      '2026-11-20;Спина;Тяга;55;8',
      '2026-11-20;Спина;Подтягивания;;12',
      '2026-11-21;Ноги;Присед;80;5',
    ].join('\n');
    const back = csvToWorkouts(csv);
    expect(back.map((w) => [w.date, w.title, w.exercises.map((e) => `${e.name}×${e.sets.length}`)])).toEqual([
      ['2026-11-20', 'Спина', ['Тяга×2', 'Подтягивания×1']],
      ['2026-11-21', 'Ноги', ['Присед×1']],
    ]);
    expect(new Set(back.map((w) => w.id)).size).toBe(2);
  });

  it('accepts Excel-style dates, «,» delimiter, reordered and extra columns', () => {
    const csv = ['Упражнение,Дата,"Вес, кг",Комментарий', 'Присед,5.1.2026,"82,5",лишняя колонка'].join('\r\n');
    const [w] = csvToWorkouts(csv);
    expect(w!.date).toBe('2026-01-05');
    expect(w!.exercises[0]!.name).toBe('Присед');
    expect(w!.exercises[0]!.sets[0]!.weight).toBe(82.5);
  });

  it('reads English column names', () => {
    const csv = ['date;workout;exercise;set;weight_kg;reps;distance_km', '2026-11-20;Push;Burpees;1;;20;'].join('\n');
    const [w] = csvToWorkouts(csv);
    expect(w).toMatchObject({ date: '2026-11-20', title: 'Push' });
    expect(w!.exercises[0]!.sets[0]).toMatchObject({ weight: null, reps: 20 });
  });

  it('skips empty lines', () => {
    const csv = ['Дата;Тренировка', '', '2026-11-20;А', ';', '2026-11-21;Б', ''].join('\n');
    expect(csvToWorkouts(csv).map((w) => w.title)).toEqual(['А', 'Б']);
  });

  it('explains what is wrong, with the line number', () => {
    expect(() => csvToWorkouts('')).toThrow(DataError);
    expect(() => csvToWorkouts('Название;Ссылка\nx;y')).toThrow(/колонки «Дата»/);
    expect(() => csvToWorkouts(`${HEADER}\n2026-02-30;;;;;;;;;`)).toThrow(/Строка 2: неверная дата «2026-02-30»/);
    expect(() => csvToWorkouts(`${HEADER}\n2026-11-20;;;Жим;1;много;;;;`)).toThrow(/Строка 2, колонка «Вес, кг»/);
    expect(() => csvToWorkouts(`${HEADER}\n2026-11-20;;;Жим;1;60;8,5;;;`)).toThrow(/целое число/);
    expect(() => csvToWorkouts(`${HEADER}\n2026-11-20;;-5;;;;;;;`)).toThrow(/Длительность/);
    expect(() => csvToWorkouts(`${HEADER}\n2026-11-20;;;Бег;1;;;;пять;`)).toThrow(/Дистанция, км/);
  });
});

describe('parseCsvRows', () => {
  it('handles quotes, escaped quotes, CRLF and line breaks inside quotes', () => {
    expect(parseCsvRows('﻿a;"b;c";"d ""e"""\r\n"f\ng";h')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['f\ng', 'h'],
    ]);
  });

  it('keeps empty trailing fields', () => {
    expect(parseCsvRows('a;;\n;b;')).toEqual([
      ['a', '', ''],
      ['', 'b', ''],
    ]);
  });
});
