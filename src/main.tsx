import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { STORAGE_KEYS, store } from './store';
import './styles.css';
import { App } from './ui/App';
import { showToast } from './ui/toast';

render(<App />, document.getElementById('app')!);

// Another tab of the app changed the data: show its version instead of overwriting it on the next edit here.
window.addEventListener('storage', (e) => {
  if (e.key === null || e.key === STORAGE_KEYS.profile || e.key === STORAGE_KEYS.meta) store.reload();
});

// Ask the browser not to evict the data under storage pressure. Granted heuristically (most readily to an installed app).
void navigator.storage?.persist?.().catch(() => undefined);

const updateApp = registerSW({
  onNeedRefresh() {
    showToast('Вышла новая версия приложения', { label: 'Обновить', run: () => void updateApp(true) }, { sticky: true });
  },
});
