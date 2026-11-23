import { useEffect, useState } from 'preact/hooks';
import { DataError, errorText } from '../io/errors';
import { parseProfileFile, summarize, type ProfileSummary } from '../io/files';
import { fmtDateShort } from '../lib/dates';
import { EXERCISES, SETS, WORKOUTS, fmtCount } from '../lib/format';
import { isIos, isStandalone } from '../lib/platform';
import type { Workout } from '../model/types';
import { store, type ImportMode } from '../store';
import { exportProfile } from './actions';
import { showToast } from './toast';

interface Loaded {
  readonly fileName: string;
  readonly workouts: readonly Workout[];
  readonly summary: ProfileSummary;
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function SummaryLine({ s }: { s: ProfileSummary }) {
  return (
    <>
      {fmtCount(s.workouts, WORKOUTS)} · {fmtCount(s.exercises, EXERCISES)} · {fmtCount(s.sets, SETS)}
      {s.from && s.to && ` · ${fmtDateShort(s.from)} – ${fmtDateShort(s.to)}`}
    </>
  );
}

export function DataScreen() {
  const workouts = store.workouts.value;
  const meta = store.meta.value;
  const current = summarize(workouts);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // picking the same file again must fire «change» again
    if (!file) return;
    setLoaded(null);
    setError(null);
    try {
      const list = parseProfileFile(file.name, await file.text());
      setLoaded({ fileName: file.name, workouts: list, summary: summarize(list) });
    } catch (err) {
      setError(err instanceof DataError ? err.message : `Не удалось прочитать файл: ${errorText(err)}`);
    }
  }

  function applyImport(mode: ImportMode) {
    if (!loaded) return;
    store.importWorkouts(loaded.workouts, mode);
    setLoaded(null);
    showToast(mode === 'replace' ? 'Данные заменены содержимым файла' : 'Файл объединён с текущими данными');
  }

  function undoImport() {
    try {
      if (store.undoImport()) showToast('Данные возвращены к состоянию до импорта');
    } catch (err) {
      setError(`Не удалось отменить импорт: ${errorText(err)}`);
    }
  }

  return (
    <div class="data">
      <section class="box">
        <h2>Резервная копия</h2>
        <p>
          Сейчас: <SummaryLine s={current} />
        </p>
        <p class="muted">
          {meta.lastExportAt ? `Последняя копия: ${fmtTime(meta.lastExportAt)}.` : 'Резервных копий ещё не было.'}
        </p>
        <div class="actions">
          <button type="button" class="btn primary" disabled={!workouts.length} onClick={() => void exportProfile('json')}>
            Сохранить JSON
          </button>
          <button type="button" class="btn" disabled={!workouts.length} onClick={() => void exportProfile('csv')}>
            Сохранить CSV
          </button>
        </div>
        <p class="hint">
          JSON — полная копия для восстановления. CSV — таблица для Excel или Numbers (строка на каждый подход); её тоже можно загрузить
          обратно. На iPhone откроется меню «Поделиться» — выберите «Сохранить в Файлы».
        </p>
      </section>

      <section class="box">
        <h2>Загрузить из файла</h2>
        <label class="btn file-btn">
          Выбрать файл JSON или CSV
          <input class="visually-hidden" type="file" accept=".json,.csv,application/json,text/csv,text/plain" onChange={onFile} />
        </label>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        {loaded && (
          <div class="import-preview">
            <p>
              <b>{loaded.fileName}</b>: <SummaryLine s={loaded.summary} />
            </p>
            {workouts.length ? (
              <>
                <p class="muted">
                  «Заменить» удалит текущие данные ({fmtCount(current.workouts, WORKOUTS)}) и поставит вместо них файл. «Объединить» добавит
                  новые тренировки из файла, а совпадающие (с тем же ID) заменит версией из файла.
                </p>
                <div class="actions">
                  <button type="button" class="btn danger" onClick={() => applyImport('replace')}>
                    Заменить мои данные
                  </button>
                  <button type="button" class="btn" onClick={() => applyImport('merge')}>
                    Объединить
                  </button>
                  <button type="button" class="btn ghost" onClick={() => setLoaded(null)}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <div class="actions">
                <button type="button" class="btn primary" onClick={() => applyImport('replace')}>
                  Загрузить
                </button>
                <button type="button" class="btn ghost" onClick={() => setLoaded(null)}>
                  Отмена
                </button>
              </div>
            )}
          </div>
        )}
        {meta.importedAt && (
          <div class="undo-import">
            <p class="muted">
              Последний импорт: {fmtTime(meta.importedAt)}. Можно вернуть данные к состоянию до него — изменения, сделанные после импорта,
              при этом пропадут.
            </p>
            <button type="button" class="btn small" onClick={undoImport}>
              Отменить импорт
            </button>
          </div>
        )}
      </section>

      <section class="box">
        <h2>Где хранятся данные</h2>
        <p>
          Только на этом устройстве, в памяти браузера (без сервера и аккаунта). У телефона и компьютера данные разные — переносите их файлом.
        </p>
        <ul class="facts">
          <li>
            Режим: <b>{isStandalone() ? 'установленное приложение' : 'вкладка браузера'}</b>
          </li>
          <li>
            Защита от автоочистки: <b>{persisted === null ? 'неизвестно' : persisted ? 'включена' : 'не гарантирована'}</b>
          </li>
        </ul>
        {isIos() && !isStandalone() && (
          <p class="warn">
            На iPhone установите приложение на экран «Домой»: в Safari нажмите «Поделиться» (в iOS 26 — в меню «⋯») → «На экран „Домой“».
            В обычной вкладке Safari может стереть данные сайта, если его не открывать больше недели.
          </p>
        )}
        <p class="muted">
          Удаление иконки приложения с экрана «Домой» удаляет и его данные. Сохраняйте резервную копию хотя бы раз в пару недель — приложение
          напомнит.
        </p>
      </section>
    </div>
  );
}
