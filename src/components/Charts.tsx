import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Discipline } from '../db/types';
import { useSettings } from '../settings';
import { indexLabel } from '../lib/grades/grades';
import type { DayLoad, ExercisePoint, GoesRow, ProgressPoint, PyramidRow, StyleRow, WeekRow } from '../lib/stats';
import { addDays, monthLabel, shortDate, todayISO, weekStart } from '../lib/dates';

// Chart colours (palette). Every filled mark gets a Coffee outline because
// Lemonade/Matcha are light on the cream surface.
export function useChartColors() {
  const { dark } = useSettings();
  return {
    onsight: '#89A377',
    flash: '#FBD271',
    redpoint: dark ? '#6AA7D1' : '#0F4E77',
    primary: dark ? '#FBD271' : '#0F4E77',
    secondary: dark ? '#E7BD8B' : '#89A377',
    honey: '#E7BD8B',
    stroke: dark ? '#F7ECDD' : '#372516',
    outline: '#372516',
    grid: dark ? 'rgba(247,236,221,0.15)' : 'rgba(55,37,22,0.12)',
    text: dark ? '#F7ECDD' : '#372516',
  };
}

const axis = (c: ReturnType<typeof useChartColors>) => ({ stroke: c.grid, tick: { fill: c.text, fontSize: 12 }, tickLine: false });
const tooltipStyle = { borderRadius: 10 };

export function PyramidChart({ rows, discipline }: { rows: PyramidRow[]; discipline: Discipline }) {
  const { grades } = useSettings();
  const c = useChartColors();
  const data = rows.map((r) => ({ ...r, label: indexLabel(r.index, discipline, grades) }));
  // Merge rows that map to the same displayed label (e.g. 6B and 6B+ both show as V4)
  const merged: typeof data = [];
  for (const r of data) {
    const last = merged[merged.length - 1];
    if (last && last.label === r.label) {
      last.onsight += r.onsight; last.flash += r.flash; last.redpoint += r.redpoint; last.total += r.total;
    } else merged.push({ ...r });
  }
  if (!merged.length) return <p className="muted">No sends for this discipline in the selected range.</p>;
  return (
    <>
      <div className="chart-box" style={{ height: Math.max(160, merged.length * 34 + 40) }}>
        <ResponsiveContainer>
          <BarChart data={merged} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={4}>
            <CartesianGrid horizontal={false} stroke={c.grid} />
            <XAxis type="number" allowDecimals={false} {...axis(c)} />
            <YAxis type="category" dataKey="label" width={56} {...axis(c)} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.grid }} />
            <Bar dataKey="onsight" name="Onsight" stackId="a" fill={c.onsight} stroke={c.outline} strokeWidth={1} />
            <Bar dataKey="flash" name="Flash" stackId="a" fill={c.flash} stroke={c.outline} strokeWidth={1} />
            <Bar dataKey="redpoint" name="Redpoint" stackId="a" fill={c.redpoint} stroke={c.outline} strokeWidth={1} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend" aria-hidden>
        <span style={{ ['--c' as string]: c.onsight }}>Onsight</span>
        <span style={{ ['--c' as string]: c.flash }}>Flash</span>
        <span style={{ ['--c' as string]: c.redpoint }}>Redpoint</span>
      </div>
    </>
  );
}

export function ProgressChart({ points, discipline }: { points: ProgressPoint[]; discipline: Discipline }) {
  const { grades } = useSettings();
  const c = useChartColors();
  if (points.length < 1) return <p className="muted">Not enough sends yet.</p>;
  const lo = Math.max(0, Math.floor(Math.min(...points.map((p) => p.median))) - 1);
  const hi = Math.ceil(Math.max(...points.map((p) => p.max))) + 1;
  const fmt = (v: number) => indexLabel(v, discipline, grades);
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="month" tickFormatter={monthLabel} {...axis(c)} minTickGap={16} />
          <YAxis domain={[lo, hi]} tickFormatter={fmt} allowDecimals={false} width={48} {...axis(c)} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => monthLabel(String(l))} formatter={(v: number, n) => [fmt(v), n]} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line type="monotone" dataKey="max" name="Hardest send" stroke={c.primary} strokeWidth={2} dot={{ r: 4, fill: c.primary }} />
          <Line type="monotone" dataKey="median" name="Median send" stroke={c.secondary} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: c.secondary }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GoesChart({ rows, discipline }: { rows: GoesRow[]; discipline: Discipline }) {
  const { grades } = useSettings();
  const c = useChartColors();
  if (!rows.length) return <p className="muted">No redpoints in this range.</p>;
  const data = rows.map((r) => ({ ...r, label: indexLabel(r.index, discipline, grades) }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axis(c)} />
          <YAxis allowDecimals={false} width={32} {...axis(c)} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.grid }} formatter={(v: number, _n, p) => [`${v} goes (${p.payload.count} redpoints)`, 'Average']} />
          <Bar dataKey="avgGoes" name="Avg goes" fill={c.redpoint} stroke={c.outline} strokeWidth={1} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StyleChart({ rows }: { rows: StyleRow[] }) {
  const c = useChartColors();
  // NB: don't pass a field called `style` to Recharts — it gets spread onto SVG nodes.
  const data = rows.filter((r) => r.delta != null).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).map((r) => ({ tag: r.style, delta: r.delta }));
  if (!data.length) return <p className="muted">Tag climbs with styles to see this.</p>;
  return (
    <div className="chart-box" style={{ height: data.length * 32 + 40 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={c.grid} />
          <XAxis type="number" {...axis(c)} tickFormatter={(v) => (v > 0 ? `+${v}` : String(v))} />
          <YAxis type="category" dataKey="tag" width={84} {...axis(c)} />
          <ReferenceLine x={0} stroke={c.stroke} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.grid }} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v} grades vs your average send`, 'Grade']} />
          <Bar dataKey="delta" name="Grades vs average" stroke={c.outline} strokeWidth={1} radius={4}>
            {data.map((r) => <Cell key={r.tag} fill={(r.delta ?? 0) >= 0 ? c.onsight : c.honey} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyBars({ rows, dataKey, name, color }: { rows: WeekRow[]; dataKey: keyof WeekRow; name: string; color: string }) {
  const c = useChartColors();
  return (
    <div className="chart-box" style={{ height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="week" tickFormatter={shortDate} minTickGap={20} {...axis(c)} />
          <YAxis allowDecimals={false} width={32} {...axis(c)} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.grid }} labelFormatter={(l) => `Week of ${shortDate(String(l))}`} />
          <Bar dataKey={dataKey as string} name={name} fill={color} stroke={c.outline} strokeWidth={1} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RatingLine({ rows }: { rows: WeekRow[] }) {
  const c = useChartColors();
  const data = rows.filter((r) => r.avgRating != null);
  if (!data.length) return <p className="muted">Rate your sessions to see this.</p>;
  return (
    <div className="chart-box" style={{ height: 180 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="week" tickFormatter={shortDate} minTickGap={20} {...axis(c)} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={24} {...axis(c)} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Week of ${shortDate(String(l))}`} />
          <Line type="monotone" dataKey="avgRating" name="Avg session rating" stroke={c.primary} strokeWidth={2} dot={{ r: 3, fill: c.primary }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExerciseChart({ points, metric, label }: { points: ExercisePoint[]; metric: keyof ExercisePoint; label: string }) {
  const c = useChartColors();
  const data = points.filter((p) => p[metric] != null);
  if (!data.length) return <p className="muted">No data for this metric.</p>;
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis(c)} />
          <YAxis width={36} {...axis(c)} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => shortDate(String(l))} />
          <Line type="monotone" dataKey={metric as string} name={label} stroke={c.primary} strokeWidth={2} dot={{ r: 3, fill: c.primary }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** GitHub-style calendar: columns are weeks, rows Mon–Sun. Single-hue ramp (Sea Blue). */
export function Heatmap({ load, weeks = 26 }: { load: Map<string, DayLoad>; weeks?: number }) {
  const { dark } = useSettings();
  const end = todayISO();
  const start = weekStart(addDays(end, -(weeks - 1) * 7));
  const ramp = dark
    ? ['#45301e', '#5b6f63', '#4f87a8', '#6aa7d1', '#a9cde6']
    : ['#fffaf3', '#c5d6e1', '#8fb1c7', '#4f7f9f', '#0f4e77'];
  const days: { date: string; v: number; c: number; t: number }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const l = load.get(d);
    days.push({ date: d, v: (l?.climbing ?? 0) + (l?.training ?? 0), c: l?.climbing ?? 0, t: l?.training ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.v));
  const step = (v: number) => (v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)));
  return (
    <div>
      <div className="heatmap" role="img" aria-label={`Activity over the last ${weeks} weeks`}>
        {days.map((d) => (
          <div key={d.date} title={`${shortDate(d.date)}: ${d.c} goes, ${d.t} training sets`} style={{ background: ramp[step(d.v)] }} />
        ))}
      </div>
      <div className="heat-legend">Less {ramp.map((c) => <i key={c} style={{ background: c }} />)} More · goes + training sets per day</div>
    </div>
  );
}
