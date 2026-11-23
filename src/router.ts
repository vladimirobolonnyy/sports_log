import { signal } from '@preact/signals';

// Hash routing: works on any static host and inside an installed PWA without server rewrites.

export const TABS = ['calendar', 'journal', 'charts', 'data'] as const;
export type Tab = (typeof TABS)[number];
export type Route = { readonly name: Tab } | { readonly name: 'workout'; readonly id: string };

export function parseRoute(hash: string): Route {
  const [head = '', arg] = hash.replace(/^#\/?/, '').split('/');
  if (head === 'workout' && arg) return { name: 'workout', id: decodeURIComponent(arg) };
  return (TABS as readonly string[]).includes(head) ? { name: head as Tab } : { name: 'calendar' };
}

export const route = signal<Route>(parseRoute(location.hash));
window.addEventListener('hashchange', () => {
  route.value = parseRoute(location.hash);
});

/** The tab the editor was opened from; closing the editor goes back there through history. */
let openedFrom: Tab | null = null;

/** Tabs replace each other in history, so «back» from a tab does not walk through every tab visited. */
export function goTab(tab: Tab): void {
  openedFrom = null;
  location.replace(`#/${tab}`);
}

export function openWorkout(id: string): void {
  const r = route.value;
  openedFrom = r.name === 'workout' ? openedFrom : r.name;
  location.hash = `#/workout/${encodeURIComponent(id)}`;
}

export function closeWorkout(): void {
  if (openedFrom) {
    openedFrom = null;
    history.back();
  } else {
    location.replace('#/calendar');
  }
}
