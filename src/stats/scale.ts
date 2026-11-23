export interface Domain {
  readonly lo: number;
  readonly hi: number;
  readonly step: number;
}

/** Axis domain with «round» ticks (1, 2, 2.5, 5 × 10ⁿ) covering [min, max] in about `ticks` steps. */
export function niceDomain(min: number, max: number, ticks = 4, integer = false): Domain {
  const span = max > min ? max - min : Math.max(Math.abs(max), 1);
  const raw = span / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const f = raw / power;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * power;
  if (integer) step = Math.max(1, Math.ceil(step));
  const lo = Math.floor(min / step) * step;
  const hi = Math.max(Math.ceil(max / step) * step, lo + step);
  return { lo, hi, step };
}

export function ticksOf({ lo, hi, step }: Domain): number[] {
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + step / 1e6; i++) out.push(Number((lo + i * step).toPrecision(12)));
  return out;
}
