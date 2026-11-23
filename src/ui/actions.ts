import { workoutsToCsv } from '../io/csv';
import { deliverFile } from '../io/files';
import { serializeProfile } from '../io/json';
import { todayIso } from '../lib/dates';
import { openWorkout } from '../router';
import { store } from '../store';
import { showToast } from './toast';

/** «Записать тренировку»: creates an empty workout for the day and opens it. */
export function recordWorkout(date: string): void {
  openWorkout(store.createWorkout(date).id);
}

/** Exports the diary. Call it straight from a click handler (see deliverFile). */
export async function exportProfile(kind: 'json' | 'csv'): Promise<void> {
  const list = store.workouts.value;
  const name = `trenirovki-${todayIso()}.${kind}`;
  const result =
    kind === 'json'
      ? await deliverFile(name, serializeProfile(list, { pretty: true, exportedAt: new Date().toISOString() }), 'application/json')
      : await deliverFile(name, workoutsToCsv(list), 'text/csv');
  if (result === 'cancelled') return;
  store.markExported();
  showToast(result === 'shared' ? `Файл ${name} передан. Проверьте, что он сохранился в «Файлах».` : `Файл ${name} скачан.`);
}
