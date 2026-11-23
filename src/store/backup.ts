import { DAYS, plural } from '../lib/format';
import type { Meta } from './store';

/** How old the last backup may get (while there are new changes) before the app reminds about it. */
export const BACKUP_MAX_AGE_DAYS = 14;
/** Without any backup the reminder waits until there is something worth losing. */
export const FIRST_BACKUP_AFTER_WORKOUTS = 3;

/** Text of the backup reminder, or null when no reminder is due. */
export function backupReminder(meta: Meta, workoutCount: number, now: number): string | null {
  if (workoutCount === 0) return null;
  if (meta.backupSnoozedUntil != null && now < meta.backupSnoozedUntil) return null;
  if (meta.lastExportAt == null) {
    return workoutCount >= FIRST_BACKUP_AFTER_WORKOUTS
      ? 'Резервной копии ещё нет, а тренировки хранятся только на этом устройстве. Сохраните JSON-файл.'
      : null;
  }
  const changed = (meta.lastChangeAt ?? 0) > meta.lastExportAt;
  const days = Math.floor((now - meta.lastExportAt) / 86_400_000);
  if (!changed || days < BACKUP_MAX_AGE_DAYS) return null;
  return `Последняя резервная копия — ${days} ${plural(days, DAYS)} назад, с тех пор есть изменения.`;
}
