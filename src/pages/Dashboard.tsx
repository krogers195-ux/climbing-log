import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Discipline, ExerciseEntry } from '../db/types';
import { DISCIPLINES, DISCIPLINE_LABEL } from '../db/types';
import { useDataset } from '../hooks';
import { useSettings } from '../settings';
import { addDays, prettyDate, todayISO } from '../lib/dates';
import { displayGrade, indexLabel } from '../lib/grades/grades';
import {
  computeSends, dailyLoad, exerciseProgress, filterAttempts, goesToSend, levelSummary, progressByMonth,
  projects, pyramid, styleAnalysis, styleSuggestions, weeklyVolume, type Filters, type Hardest,
} from '../lib/stats';
import { Chips, Empty, Stat } from '../components/ui';
import {
  ExerciseChart, GoesChart, Heatmap, ProgressChart, PyramidChart, RatingLine, StyleChart, WeeklyBars, useChartColors,
} from '../components/Charts';
import { href, useRoute } from '../router';

type Range = '90d' | '6m' | '12m' | 'all' | 'custom';

function FiltersBar({ f, setF, range, setRange, locations }: {
  f: Filters; setF: (f: Filters) => void; range: Range; setRange: (r: Range) => void;
  locations: { id: string; name: string }[];
}) {
  return (
    <div className="card plain stack" style={{ padding: 12 }}>
      <Chips options={['90d', '6m', '12m', 'all', 'custom'] as const} value={range} onChange={setRange}
        labels={{ '90d': '90 days', '6m': '6 months', '12m': '12 months', all: 'All time', custom: 'Custom' }} label="Date range" />
      <div className="filters">
        {range === 'custom' && (
          <>
            <label className="field">From<input type="date" value={f.from ?? ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} /></label>
            <label className="field">To<input type="date" value={f.to ?? ''} onChange={(e) => setF({ ...f, to: e.target.value || undefined })} /></label>
          </>
        )}
        <label className="field">
          Discipline
          <select value={f.disciplines?.[0] ?? ''} onChange={(e) => setF({ ...f, disciplines: e.target.value ? [e.target.value as Discipline] : undefined })}>
            <option value="">All</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
          </select>
        </label>
        <label className="field">
          Indoor / outdoor
          <select value={f.setting ?? 'all'} onChange={(e) => setF({ ...f, setting: e.target.value as Filters['setting'] })}>
            <option value="all">Both</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </label>
        <label className="field">
          Location
          <select value={f.locationId ?? ''} onChange={(e) => setF({ ...f, locationId: e.target.value || undefined })}>
            <option value="">All</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function GradeCell({ h, d }: { h: Hardest | null; d: Discipline }) {
  const { grades } = useSettings();
  if (!h) return <td className="g" aria-label="none">–</td>;
  return (
    <td className="g">
      <a href={href(`/climb/${h.climb.id}`)} style={{ color: 'inherit', textDecoration: 'none' }} title={`${h.climb.name}, ${prettyDate(h.date)}`}>
        {indexLabel(h.index, d, grades)}
      </a>
    </td>
  );
}

export default function Dashboard() {
  const ds = useDataset();
  const { grades } = useSettings();
  const colors = useChartColors();
  const { query } = useRoute();
  const today = todayISO();
  const [range, setRange] = useState<Range>('12m');
  const [f, setF] = useState<Filters>({ setting: 'all', locationId: query.get('loc') ?? undefined });
  const [chartDisc, setChartDisc] = useState<Discipline | null>(null);
  const [exId, setExId] = useState<string>('');
  const [metric, setMetric] = useState<'maxAdded' | 'maxReps' | 'maxHang' | 'maxWeight'>('maxAdded');

  useEffect(() => {
    const loc = query.get('loc');
    if (loc) setF((x) => ({ ...x, locationId: loc }));
  }, [query.get('loc')]);

  const filters: Filters = useMemo(() => {
    if (range === 'custom') return f;
    const from = range === '90d' ? addDays(today, -90) : range === '6m' ? addDays(today, -183) : range === '12m' ? addDays(today, -365) : undefined;
    return { ...f, from, to: undefined };
  }, [f, range, today]);

  const data = useMemo(() => {
    if (!ds) return null;
    const noDate = { ...filters, from: undefined, to: undefined };
    const allSends = computeSends(ds, noDate);
    const sends = computeSends(ds, filters);
    const atts = filterAttempts(ds, filters);
    const styles = styleAnalysis(ds, filters);
    return {
      level: levelSummary(allSends, today),
      sends,
      atts,
      styles,
      suggestions: styleSuggestions(styles),
      weeks: weeklyVolume(ds, filters),
      load: dailyLoad(ds, addDays(today, -26 * 7 - 7), today, noDate),
      projects: projects(ds).filter((p) => !filters.locationId || p.climb.locationId === filters.locationId),
    };
  }, [ds, filters, today]);

  if (!ds || !data) return null;
  if (!ds.sessions.length && !ds.training.length) {
    return (
      <Empty title="Welcome to Sendlog">
        <p>Log your first session to see your level, pyramid and progress here.</p>
        <a className="btn big" href={href('/log')}>Start a session</a>
      </Empty>
    );
  }

  const discs = DISCIPLINES.filter((d) => data.sends.some((s) => s.climb.discipline === d));
  const disc = chartDisc && discs.includes(chartDisc) ? chartDisc : discs[0];
  const discSends = data.sends.filter((s) => s.climb.discipline === disc);
  const exercisesUsed = ds.exercises.filter((e) => ds.training.some((t) => t.exercises.some((x: ExerciseEntry) => x.exerciseId === e.id)));
  const ex = exId || exercisesUsed.find((e) => e.id === 'ex-hang-20')?.id || exercisesUsed[0]?.id || '';
  const exPoints = ex ? exerciseProgress(ds.training, ex, filters) : [];
  const totalGoes = data.atts.reduce((p, a) => p + a.goes, 0);
  const sessionsInRange = new Set(data.atts.map((a) => a.sessionId)).size;
  const trainingInRange = ds.training.filter((t) => (!filters.from || t.date >= filters.from) && (!filters.to || t.date <= filters.to)).length;
  const sorted = [...data.level];

  return (
    <div className="stack">
      <h1>Your climbing</h1>
      <FiltersBar f={f} setF={setF} range={range} setRange={setRange} locations={ds.locations} />

      <div className="stat-row">
        <Stat label="Sessions" value={sessionsInRange} />
        <Stat label="Goes" value={totalGoes} />
        <Stat label="New sends" value={data.sends.length} />
        <Stat label="Training" value={trainingInRange} meta="sessions" />
      </div>

      <section className="card" aria-labelledby="lvl">
        <h2 id="lvl">Current level</h2>
        <p className="muted" style={{ fontSize: '0.9rem' }}>Hardest first ascents. “Consistent” is the grade you've sent at least 3 of (at or above) in the last 90 days.</p>
        {sorted.length === 0 ? <p className="muted">No sends yet.</p> : (
          <div className="table-wrap">
            <table className="level-table">
              <thead>
                <tr><th></th><th>Onsight</th><th>Flash</th><th>Redpoint</th><th>Consistent</th></tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <Fragment key={r.discipline}>
                    <tr>
                      <th scope="row" style={{ textTransform: 'none', fontSize: '0.95rem', color: 'var(--text)' }}>{DISCIPLINE_LABEL[r.discipline]}<div className="muted" style={{ fontWeight: 400, fontSize: '0.78rem' }}>last 90 days</div></th>
                      <GradeCell h={r.last90.onsight} d={r.discipline} />
                      <GradeCell h={r.last90.flash} d={r.discipline} />
                      <GradeCell h={r.last90.redpoint} d={r.discipline} />
                      <td className="g">{r.consistent90 != null ? indexLabel(r.consistent90, r.discipline, grades) : '–'}</td>
                    </tr>
                    <tr>
                      <th scope="row" style={{ fontWeight: 400, fontSize: '0.78rem' }}>all time</th>
                      <GradeCell h={r.allTime.onsight} d={r.discipline} />
                      <GradeCell h={r.allTime.flash} d={r.discipline} />
                      <GradeCell h={r.allTime.redpoint} d={r.discipline} />
                      <td className="muted">{r.sendCount} sends</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {discs.length > 0 && disc && (
        <>
          <Chips scroll options={discs} value={disc} onChange={setChartDisc} labels={DISCIPLINE_LABEL} label="Chart discipline" />
          <div className="grid grid-2">
            <section className="card">
              <h2>Pyramid</h2>
              <PyramidChart rows={pyramid(discSends)} discipline={disc} />
            </section>
            <section className="card">
              <h2>Progress</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>Hardest and median first-ascent grade per month.</p>
              <ProgressChart points={progressByMonth(discSends)} discipline={disc} />
            </section>
            <section className="card">
              <h2>Goes to send</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>Average goes before a redpoint, counted across sessions.</p>
              <GoesChart rows={goesToSend(discSends)} discipline={disc} />
            </section>
            <section className="card">
              <h2>Style strengths</h2>
              <p className="muted" style={{ fontSize: '0.9rem' }}>Average send grade by style, compared with your overall average.</p>
              <StyleChart rows={data.styles} />
            </section>
          </div>
        </>
      )}

      <section className="card">
        <h2>Where you could improve</h2>
        {data.suggestions.length ? (
          <ul className="suggestions">{data.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
        ) : <p className="muted">Log more climbs with style tags to get suggestions.</p>}
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Style table</summary>
          <div className="table-wrap">
            <table className="level-table">
              <thead><tr><th>Style</th><th>Tried</th><th>Sent</th><th>Send rate</th><th>vs average</th></tr></thead>
              <tbody>
                {data.styles.map((r) => (
                  <tr key={r.style}>
                    <td>{r.style}</td><td>{r.tried}</td><td>{r.sent}</td><td>{r.tried ? `${Math.round(r.sendRate * 100)}%` : '–'}</td>
                    <td>{r.delta == null ? '–' : `${r.delta > 0 ? '+' : ''}${r.delta}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="card">
        <h2>Activity</h2>
        <Heatmap load={data.load} />
      </section>

      <div className="grid grid-2">
        <section className="card">
          <h2>Goes per week</h2>
          <WeeklyBars rows={data.weeks} dataKey="goes" name="Goes" color={colors.redpoint} />
        </section>
        <section className="card">
          <h2>Climbs per week</h2>
          <WeeklyBars rows={data.weeks} dataKey="climbs" name="Climbs" color={colors.onsight} />
        </section>
        <section className="card">
          <h2>Training sets per week</h2>
          <WeeklyBars rows={data.weeks} dataKey="trainingSets" name="Sets" color={colors.honey} />
        </section>
        <section className="card">
          <h2>Session ratings</h2>
          <RatingLine rows={data.weeks} />
        </section>
      </div>

      {exercisesUsed.length > 0 && (
        <section className="card">
          <h2>Training trends</h2>
          <div className="form-grid two">
            <label className="field">
              Exercise
              <select value={ex} onChange={(e) => setExId(e.target.value)}>
                {exercisesUsed.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label className="field">
              Metric
              <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
                <option value="maxAdded">Added weight (kg)</option>
                <option value="maxReps">Max reps</option>
                <option value="maxHang">Hang time (s)</option>
                <option value="maxWeight">Weight (kg)</option>
              </select>
            </label>
          </div>
          <ExerciseChart points={exPoints} metric={metric} label={{ maxAdded: 'Added kg', maxReps: 'Reps', maxHang: 'Hang s', maxWeight: 'Weight kg' }[metric]} />
        </section>
      )}

      <section className="card">
        <div className="row between"><h2>Projects</h2><a href={href('/climbs?status=project')}>All projects</a></div>
        {data.projects.length === 0 ? <p className="muted">No open projects.</p> : (
          <ul className="list">
            {data.projects.slice(0, 8).map((p) => (
              <li key={p.climb.id}>
                <a className="list-item" href={href(`/climb/${p.climb.id}`)}>
                  <span className="grade">{displayGrade(p.climb, grades)}</span>
                  <span className="grow">
                    <div className="title">{p.climb.name}</div>
                    <div className="sub">{p.goes} goes · {p.sessions} session{p.sessions === 1 ? '' : 's'}{p.highPoint ? ` · high point: ${p.highPoint}` : ''}{p.climb.beta ? ' · has beta' : ''}</div>
                  </span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>{p.lastTried ? prettyDate(p.lastTried) : ''}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <a className="card card-link" href={href('/locations')}>
        <h2 style={{ marginBottom: 4 }}>Locations →</h2>
        <span className="muted">{ds.locations.length} crags & gyms in {new Set(ds.locations.map((l) => l.country)).size} countries</span>
      </a>
    </div>
  );
}

