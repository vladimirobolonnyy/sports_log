import { signal } from '@preact/signals';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  readonly text: string;
  readonly action?: ToastAction;
  /** Stays until closed (e.g. «new version available»). */
  readonly sticky: boolean;
}

export const toast = signal<Toast | null>(null);

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, action?: ToastAction, { sticky = false } = {}): void {
  clearTimeout(timer);
  const t: Toast = { id: ++seq, text, sticky, ...(action ? { action } : {}) };
  toast.value = t;
  if (!sticky) {
    timer = setTimeout(() => {
      if (toast.value?.id === t.id) toast.value = null;
    }, action ? 6000 : 3500);
  }
}

export function hideToast(): void {
  clearTimeout(timer);
  toast.value = null;
}
