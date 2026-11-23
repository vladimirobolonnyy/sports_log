import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fmtDayLong } from '../lib/dates';
import { sanitizeNumber, toInputText } from '../lib/format';
import { exerciseKey, workoutSummary, workoutTitle } from '../model/derive';
import { TYPE_META, type Workout, type WorkoutType } from '../model/types';
import { openWorkout } from '../router';

export const typeColor = (t: WorkoutType): string => `--c:var(--t-${t})`;

export function TypeIcon({ type, small = false }: { type: WorkoutType; small?: boolean }) {
  return (
    <span class={small ? 'ico small' : 'ico'} style={typeColor(type)} aria-hidden="true">
      {TYPE_META[type].icon}
    </span>
  );
}

/** A workout in a list; opens the editor. */
export function WorkoutRow({ workout, withDate = false }: { workout: Workout; withDate?: boolean }) {
  return (
    <button type="button" class="entry" onClick={() => openWorkout(workout.id)}>
      <TypeIcon type={workout.type} />
      <span class="info">
        <span class="t">{workoutTitle(workout)}</span>
        <span class="m">
          {withDate ? `${fmtDayLong(workout.date)} · ` : ''}
          {workoutSummary(workout)}
        </span>
      </span>
      <span class="chev" aria-hidden="true">›</span>
    </button>
  );
}

/**
 * Numeric input that keeps the text as typed («62,» while typing «62,5») and reports the parsed value.
 * type="text" + inputmode: iOS shows the numeric pad, and both «,» and «.» are accepted as the decimal mark.
 */
export function NumberInput(props: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  integer?: boolean;
  placeholder?: string;
}) {
  const { value, onChange, label, integer = false, placeholder } = props;
  const [text, setText] = useState(toInputText(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(toInputText(value));
  }, [value]);

  return (
    <input
      class="input num"
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autocomplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(toInputText(value));
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        const clean = sanitizeNumber(el.value, integer);
        if (clean !== el.value) el.value = clean;
        setText(clean);
        onChange(clean === '' || clean === ',' ? null : Number(clean.replace(',', '.')));
      }}
    />
  );
}

/** Text input with tap-to-fill suggestions (names used before) shown under it while it has focus. */
export function SuggestInput(props: {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { value, onChange, suggestions, label, placeholder, autoFocus = false } = props;
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const query = exerciseKey(value);
  const items = open ? suggestions.filter((s) => exerciseKey(s) !== query && exerciseKey(s).includes(query)).slice(0, 6) : [];

  return (
    <div class="suggest">
      <input
        ref={input}
        class="input"
        type="text"
        autocomplete="off"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onInput={(e) => onChange(e.currentTarget.value)}
        onFocus={() => {
          clearTimeout(closeTimer.current);
          setOpen(true);
        }}
        // Delayed so that a tap on a suggestion (which blurs the input first) still lands.
        onBlur={() => (closeTimer.current = setTimeout(() => setOpen(false), 200))}
      />
      {items.length > 0 && (
        <div class="chips">
          {items.map((s) => (
            <button
              type="button"
              class="chip"
              key={s}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Segmented control. */
export function Segmented<T extends string | number>(props: {
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div class="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          aria-pressed={o.value === props.value}
          disabled={o.disabled}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div class="kpi">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function EmptyState({ children }: { children: ComponentChildren }) {
  return <div class="box empty-state">{children}</div>;
}
