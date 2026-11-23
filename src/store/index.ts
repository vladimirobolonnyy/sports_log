import { MemoryStorage } from './memoryStorage';
import { createStore } from './store';

export { STORAGE_KEYS, type ImportMode, type Meta, type Store } from './store';

function openStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = 'sport-log/probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const browserStorage = openStorage();

/** The app's single store, backed by localStorage. */
export const store = createStore(browserStorage ?? new MemoryStorage());

if (!browserStorage) {
  store.loadError.value = 'Браузер не даёт сохранять данные (приватный режим или запрет хранилища). Всё, что вы запишете, пропадёт после закрытия страницы.';
}
