import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { todayIso } from '../lib/dates';
import { isIos, isStandalone } from '../lib/platform';
import { goTab, route, type Route, type Tab } from '../router';
import { store } from '../store';
import { backupReminder } from '../store/backup';
import { exportProfile, recordWorkout } from './actions';
import { CalendarScreen } from './CalendarScreen';
import { ChartsScreen } from './ChartsScreen';
import { DataScreen } from './DataScreen';
import { JournalScreen } from './JournalScreen';
import { WorkoutEditor } from './WorkoutEditor';
import { hideToast, toast } from './toast';

const icon = (paths: JSX.Element) => (
  <svg class="tab-ico" viewBox="0 0 24 24" aria-hidden="true">
    {paths}
  </svg>
);

const TAB_ITEMS: readonly { tab: Tab; label: string; icon: JSX.Element }[] = [
  {
    tab: 'calendar',
    label: 'Календарь',
    icon: icon(
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>,
    ),
  },
  { tab: 'journal', label: 'Журнал', icon: icon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />) },
  { tab: 'charts', label: 'Графики', icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />) },
  { tab: 'data', label: 'Данные', icon: icon(<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />) },
];

function Tabs({ current, placement }: { current: Route['name']; placement: 'top' | 'bottom' }) {
  return (
    <nav class={`tabs tabs-${placement}`} aria-label="Разделы">
      {TAB_ITEMS.map((t) => (
        <button type="button" key={t.tab} class="tab" aria-current={current === t.tab ? 'page' : undefined} onClick={() => goTab(t.tab)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function StorageErrors() {
  const errors = [store.loadError.value, store.saveError.value].filter(Boolean);
  return (
    <>
      {errors.map((e) => (
        <div class="banner danger" role="alert" key={e}>
          {e}
        </div>
      ))}
    </>
  );
}

function Reminders() {
  const meta = store.meta.value;
  const backup = backupReminder(meta, store.workouts.value.length, Date.now());
  const install = isIos() && !isStandalone() && !meta.installHintDismissed;
  return (
    <>
      {install && (
        <div class="banner">
          <div>
            <b>Установите приложение на экран «Домой»</b>: «Поделиться» (в iOS 26 — в меню «⋯») → «На экран „Домой“». В обычной вкладке
            Safari может стереть данные сайта, если его не открывать больше недели.
          </div>
          <button type="button" class="btn small" onClick={() => store.dismissInstallHint()}>
            Понятно
          </button>
        </div>
      )}
      {backup && (
        <div class="banner">
          <div>{backup}</div>
          <div class="banner-actions">
            <button type="button" class="btn small primary" onClick={() => void exportProfile('json')}>
              Сохранить JSON
            </button>
            <button type="button" class="btn small" onClick={() => store.snoozeBackupReminder(3)}>
              Позже
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ToastView() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" role="status" key={t.id}>
      <span>{t.text}</span>
      {t.action && (
        <button
          type="button"
          class="toast-btn"
          onClick={() => {
            t.action?.run();
            hideToast();
          }}
        >
          {t.action.label}
        </button>
      )}
      {t.sticky && (
        <button type="button" class="toast-btn" aria-label="Закрыть" onClick={hideToast}>
          ✕
        </button>
      )}
    </div>
  );
}

const SCREENS: Record<Tab, () => JSX.Element> = {
  calendar: CalendarScreen,
  journal: JournalScreen,
  charts: ChartsScreen,
  data: DataScreen,
};

export function App() {
  const r = route.value;
  const screenKey = r.name === 'workout' ? `workout/${r.id}` : r.name;
  useEffect(() => window.scrollTo(0, 0), [screenKey]);

  let content: JSX.Element;
  if (r.name === 'workout') {
    content = <WorkoutEditor key={r.id} id={r.id} />;
  } else {
    const Screen = SCREENS[r.name];
    content = (
      <>
        {(r.name === 'calendar' || r.name === 'journal') && <Reminders />}
        <Screen />
      </>
    );
  }

  return (
    <div class={r.name === 'workout' ? 'app editing' : 'app'}>
      <header class="topbar">
        <div class="topbar-in">
          <span class="brand">
            <img src="icon.svg" alt="" width="28" height="28" />
            Тренировки
          </span>
          <Tabs current={r.name} placement="top" />
        </div>
      </header>
      <main class="main">
        <StorageErrors />
        {content}
      </main>
      {(r.name === 'calendar' || r.name === 'journal') && (
        <button type="button" class="fab" aria-label="Новая тренировка" onClick={() => recordWorkout(todayIso())}>
          <span aria-hidden="true">+</span> Тренировка
        </button>
      )}
      <Tabs current={r.name} placement="bottom" />
      <ToastView />
    </div>
  );
}
