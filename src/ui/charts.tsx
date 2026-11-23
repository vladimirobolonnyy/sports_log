import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { daysBetween, fmtDateShort, fmtDayMonth } from '../lib/dates';
import { fmtAxis } from '../lib/format';
import { niceDomain, ticksOf } from '../stats/scale';

// Hand-drawn SVG charts: no chart library to update or break over the years. Tap a bar or a point to read its value.

const PAD = { left: 44, right: 10, top: 10, bottom: 24 } as const;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Bar {
  readonly label: string;
  /** Caption shown for the selected bar, e.g. the week's dates. */
  readonly title: string;
  readonly value: number;
}

export function BarChart(props: { data: readonly Bar[]; format: (n: number) => string; integer?: boolean; height?: number }) {
  const { data, format, integer = false, height = 200 } = props;
  const [ref, width] = useWidth();
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked !== null && picked < data.length ? picked : data.length - 1;
  const current = data[sel];

  const domain = niceDomain(0, Math.max(0, ...data.map((d) => d.value)), 4, integer);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(32, slot * 0.62));
  const y = (v: number) => PAD.top + innerH - (v / domain.hi) * innerH;
  // Label every n-th bar so labels never overlap; the last (current) bar always gets one.
  const every = Math.max(1, Math.ceil(44 / Math.max(slot, 1)));

  return (
    <div class="chart" ref={ref}>
      <div class="chart-cap">
        {current && (
          <>
            <b>{format(current.value)}</b> <span class="muted">{current.title}</span>
          </>
        )}
      </div>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={current ? `${current.title}: ${format(current.value)}` : ''}>
          {ticksOf(domain).map((t) => (
            <g key={t}>
              <line class="grid-line" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text class="axis-y" x={PAD.left - 6} y={y(t) + 4}>
                {fmtAxis(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * slot;
            return (
              <g key={i} class="bar-slot" onClick={() => setPicked(i)}>
                <rect class="hit" x={x} y={PAD.top} width={slot} height={innerH + PAD.bottom} />
                {d.value > 0 && (
                  <rect
                    class={i === sel ? 'bar sel' : 'bar'}
                    x={x + (slot - barW) / 2}
                    y={y(d.value)}
                    width={barW}
                    height={Math.max(1, PAD.top + innerH - y(d.value))}
                    rx={Math.min(4, barW / 2)}
                  />
                )}
                {(data.length - 1 - i) % every === 0 && (
                  <text class="axis-x" x={x + slot / 2} y={height - 6}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export interface Point {
  readonly date: string;
  readonly value: number;
}

export function LineChart(props: { points: readonly Point[]; format: (n: number) => string; height?: number }) {
  const { points, format, height = 220 } = props;
  const [ref, width] = useWidth();
  const svg = useRef<SVGSVGElement>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked !== null && picked < points.length ? picked : points.length - 1;
  const current = points[sel];
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Start the axis at zero unless that would squash the line into a flat band near the top.
  const domain = niceDomain(min > max * 0.4 ? min - (max - min) * 0.3 : 0, max, 4);
  const lo = Math.max(0, domain.lo);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const span = daysBetween(first.date, last.date);
  const x = (p: Point) => PAD.left + (span ? (daysBetween(first.date, p.date) / span) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (domain.hi - lo)) * innerH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  const pick = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const px = clientX - box.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p) - px) < Math.abs(x(points[best]!) - px)) best = i;
    });
    setPicked(best);
  };

  return (
    <div class="chart" ref={ref}>
      <div class="chart-cap">
        {current && (
          <>
            <b>{format(current.value)}</b> <span class="muted">{fmtDateShort(current.date)}</span>
          </>
        )}
      </div>
      {width > 0 && (
        <svg
          ref={svg}
          width={width}
          height={height}
          role="img"
          aria-label={current ? `${fmtDateShort(current.date)}: ${format(current.value)}` : ''}
          onClick={(e) => pick(e.clientX)}
        >
          {ticksOf({ ...domain, lo }).map((t) => (
            <g key={t}>
              <line class="grid-line" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text class="axis-y" x={PAD.left - 6} y={y(t) + 4}>
                {fmtAxis(t)}
              </text>
            </g>
          ))}
          <path class="line" d={path} />
          {points.map((p, i) => (
            <circle key={i} class={i === sel ? 'pt sel' : 'pt'} cx={x(p)} cy={y(p.value)} r={i === sel ? 5.5 : 3.5} />
          ))}
          <text class="axis-x start" x={PAD.left} y={height - 6}>
            {fmtDayMonth(first.date)}
          </text>
          {span > 0 && (
            <text class="axis-x end" x={width - PAD.right} y={height - 6}>
              {fmtDayMonth(last.date)}
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
