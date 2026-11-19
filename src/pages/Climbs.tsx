import { useMemo, useState } from 'react';
import { db, deleteClimb } from '../db/db';
import type { Climb, Discipline, GradeSystem, StyleTag } from '../db/types';
import { DISCIPLINES, DISCIPLINE_LABEL, GRADE_SYSTEM_LABEL, RESULT_LABEL, STYLE_TAGS } from '../db/types';
import { useDataset, useGrade, toast } from '../hooks';
import { climbIndex, computeSends, totalGoes } from '../lib/stats';
import { prettyDate } from '../lib/dates';
import { Chips, Empty, GradePicker, Rating, num } from '../components/ui';
import { MediaGallery } from '../components/Media';
import { go, href } from '../router';
import { isValidGrade } from '../lib/grades/grades';

type StatusFilter = 'all' | 'project' | 'sent';
type Sort = 'recent' | 'grade' | 'name';

export function ClimbsPage({ query }: { query: URLSearchParams }) {
  const ds = useDataset();
  const fmt = useGrade();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>((query.get('status') as StatusFilter) ?? 'all');
  const [disc, setDisc] = useState<Discipline | 'all'>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [limit, setLimit] = useState(60);

  const rows = useMemo(() => {
    if (!ds) return [];
    const locs = new Map(ds.locations.map((l) => [l.id, l]));
    const last = new Map<string, string>();
    for (const a of ds.attempts) if ((last.get(a.climbId) ?? '') < a.date) last.set(a.climbId, a.date);
    const needle = q.trim().toLowerCase();
    return ds.climbs
      .filter((c) => status === 'all' || c.status === status)
      .filter((c) => disc === 'all' || c.discipline === disc)
      .filter((c) => {
        if (!needle) return true;
        const l = locs.get(c.locationId ?? '');
        return [c.name, c.sector, l?.name, l?.area, c.beta, ...c.styles].some((x) => x?.toLowerCase().includes(needle));
      })
      .map((c) => ({ c, loc: locs.get(c.locationId ?? ''), last: last.get(c.id) ?? '', idx: climbIndex(c) ?? -1 }))
      .sort((a, b) =>
        sort === 'grade' ? b.idx - a.idx : sort === 'name' ? a.c.name.localeCompare(b.c.name) : a.last < b.last ? 1 : -1,
      );
  }, [ds, q, status, disc, sort]);

  if (!ds) return null;
  return (
    <div className="stack">
      <h1>Climbs</h1>
      <input type="search" aria-label="Search climbs" placeholder="Search name, crag, sector, style…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips options={['all', 'project', 'sent'] as const} value={status} onChange={setStatus} labels={{ all: 'All', project: 'Projects', sent: 'Sent' }} label="Status" />
      <Chips scroll options={['all', ...DISCIPLINES] as const} value={disc} onChange={setDisc} labels={{ all: 'All disciplines', ...DISCIPLINE_LABEL }} label="Discipline" />
      <label className="field" style={{ maxWidth: 240 }}>
        Sort by
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Recently climbed</option>
          <option value="grade">Hardest first</option>
          <option value="name">Name</option>
        </select>
      </label>
      {rows.length === 0 ? (
        <Empty title="No climbs found" />
      ) : (
        <div className="card">
          <ul className="list">
            {rows.slice(0, limit).map(({ c, loc, last }) => (
              <li key={c.id}>
                <a className="list-item" href={href(`/climb/${c.id}`)}>
                  <span className="grade">{fmt(c)}</span>
                  <span className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">{[loc?.name, c.sector, DISCIPLINE_LABEL[c.discipline], last && prettyDate(last)].filter(Boolean).join(' · ')}</div>
                  </span>
                  <span className={`badge ${c.status === 'sent' ? 'send' : 'project'}`}>{c.status === 'sent' ? 'Sent' : 'Project'}</span>
                </a>
              </li>
            ))}
          </ul>
          {rows.length > limit && <button className="btn secondary block" onClick={() => setLimit(limit + 60)}>Show more ({rows.length - limit})</button>}
        </div>
      )}
    </div>
  );
}

function ClimbEditor({ c, onDone }: { c: Climb; onDone: () => void }) {
  const ds = useDataset();
  const [f, setF] = useState<Climb>({ ...c });
  const set = <K extends keyof Climb>(k: K, v: Climb[K]) => setF((x) => ({ ...x, [k]: v }));
  const [len, setLen] = useState(String(c.lengthM ?? ''));
  if (!ds) return null;
  const save = async () => {
    await db.climbs.put({ ...f, name: f.name.trim() || c.name, lengthM: num(len) });
    toast('Climb saved');
    onDone();
  };
  return (
    <div className="card stack">
      <label className="field">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="form-grid two">
        <label className="field">
          Location
          <select value={f.locationId ?? ''} onChange={(e) => set('locationId', e.target.value || undefined)}>
            <option value="">—</option>
            {ds.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="field">Sector<input value={f.sector ?? ''} onChange={(e) => set('sector', e.target.value || undefined)} /></label>
      </div>
      <Chips options={DISCIPLINES} value={f.discipline} labels={DISCIPLINE_LABEL} label="Discipline" onChange={(d: Discipline) => set('discipline', d)} />
      <GradePicker discipline={f.discipline} system={f.gradeSystem} grade={f.grade} onChange={(g, s: GradeSystem) => setF((x) => ({ ...x, grade: g, gradeSystem: s }))} />
      <fieldset><legend>Style</legend><Chips multi options={STYLE_TAGS} value={f.styles} onChange={(v: StyleTag[]) => set('styles', v)} label="Style tags" /></fieldset>
      <div className="form-grid two">
        <label className="field">Rock type<input value={f.rockType ?? ''} onChange={(e) => set('rockType', e.target.value || undefined)} /></label>
        <label className="field">Height / length (m)<input inputMode="decimal" value={len} onChange={(e) => setLen(e.target.value)} /></label>
      </div>
      <fieldset><legend>Stars</legend><Rating max={3} value={f.stars} onChange={(v) => set('stars', v)} label="Stars" /></fieldset>
      <Chips options={['liked', 'disliked'] as const} value={f.liked} labels={{ liked: '👍 Liked', disliked: '👎 Disliked' }} label="Liked or disliked"
        onChange={(v: 'liked' | 'disliked') => set('liked', f.liked === v ? undefined : v)} />
      <label className="field">What I liked / didn't like<textarea value={f.likeNotes ?? ''} onChange={(e) => set('likeNotes', e.target.value || undefined)} /></label>
      <label className="field">Beta notes<textarea value={f.beta ?? ''} onChange={(e) => set('beta', e.target.value || undefined)} /></label>
      <Chips options={['project', 'sent'] as const} value={f.status} labels={{ project: 'Project', sent: 'Sent' }} label="Status" onChange={(v: Climb['status']) => set('status', v)} />
      <div className="row">
        <button className="btn" disabled={!isValidGrade(f.grade, f.gradeSystem)} onClick={save}>Save</button>
        <button className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export function ClimbDetail({ id }: { id?: string }) {
  const ds = useDataset();
  const fmt = useGrade();
  const [editing, setEditing] = useState(false);
  if (!ds) return null;
  const c = ds.climbs.find((x) => x.id === id);
  if (!c) return <Empty title="Climb not found"><a href={href('/climbs')}>All climbs</a></Empty>;
  const loc = ds.locations.find((l) => l.id === c.locationId);
  const atts = ds.attempts.filter((a) => a.climbId === c.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const send = computeSends({ ...ds, attempts: ds.attempts.filter((a) => a.climbId === c.id) })[0];
  const shown = fmt(c);
  return (
    <div className="stack">
      <div>
        <a href={href('/climbs')}>← Climbs</a>
        <div className="row" style={{ marginTop: 8, alignItems: 'baseline' }}>
          <h1 style={{ margin: 0 }}>{c.name}</h1>
          <span className="grade" style={{ fontSize: '2.2rem' }}>{shown}</span>
        </div>
        <div className="row">
          {loc && <a href={href(`/location/${loc.id}`)}>{loc.name}</a>}
          {c.sector && <span className="muted">· {c.sector}</span>}
          <span className="badge">{DISCIPLINE_LABEL[c.discipline]}</span>
          <span className={`badge ${c.status === 'sent' ? 'send' : 'project'}`}>{c.status === 'sent' ? 'Sent' : 'Project'}</span>
          {shown !== c.grade && <span className="muted">Logged as {c.grade} ({GRADE_SYSTEM_LABEL[c.gradeSystem]})</span>}
        </div>
      </div>
      {editing ? <ClimbEditor c={c} onDone={() => setEditing(false)} /> : (
        <div className="card stack">
          <div className="stat-row">
            <div className="stat"><div className="label">Total goes</div><div className="value">{totalGoes(ds.attempts, c.id)}</div></div>
            <div className="stat"><div className="label">Sessions</div><div className="value">{new Set(atts.map((a) => a.sessionId)).size}</div></div>
            <div className="stat"><div className="label">Sent</div><div className="value">{send ? RESULT_LABEL[send.style] : '–'}</div><div className="meta">{send ? `${prettyDate(send.date)} · ${send.goes} go${send.goes > 1 ? 's' : ''}` : 'Not yet'}</div></div>
            <div className="stat"><div className="label">Stars</div><div className="value">{c.stars ? '★'.repeat(c.stars) : '–'}</div></div>
          </div>
          {c.styles.length > 0 && <div className="row">{c.styles.map((s) => <span key={s} className="badge outline">{s}</span>)}</div>}
          {(c.rockType || c.lengthM) && <p style={{ margin: 0 }} className="muted">{[c.rockType, c.lengthM && `${c.lengthM} m`].filter(Boolean).join(' · ')}</p>}
          {(c.liked || c.likeNotes) && <p style={{ margin: 0 }}><strong>{c.liked === 'liked' ? '👍 Liked' : c.liked === 'disliked' ? '👎 Didn’t like' : 'Thoughts'}:</strong> {c.likeNotes}</p>}
          <div id="beta">
            <h3>Beta</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.beta || <span className="muted">No beta notes yet.</span>}</p>
          </div>
          <div className="row"><button className="btn secondary" onClick={() => setEditing(true)}>Edit climb</button></div>
        </div>
      )}
      <div className="card">
        <h2>Photos & videos</h2>
        <MediaGallery ownerType="climb" ownerId={c.id} />
      </div>
      <div className="card">
        <h2>History</h2>
        {atts.length ? (
          <ul className="list">
            {atts.map((a) => (
              <li key={a.id}>
                <a className="list-item" href={href(`/session/${a.sessionId}`)}>
                  <span className="grow">
                    <div className="title">{prettyDate(a.date)}</div>
                    <div className="sub">{a.goes} go{a.goes > 1 ? 's' : ''}{a.highPoint ? ` · high point: ${a.highPoint}` : ''}{a.notes ? ` · ${a.notes}` : ''}</div>
                  </span>
                  <span className={`badge ${['onsight', 'flash', 'redpoint', 'repeat'].includes(a.result) ? 'send' : 'outline'}`}>{RESULT_LABEL[a.result]}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No attempts logged.</p>}
      </div>
      <button className="btn danger" onClick={async () => {
        if (!window.confirm(`Delete “${c.name}”, its ${atts.length} attempts and media? This cannot be undone.`)) return;
        await deleteClimb(c.id);
        toast('Climb deleted');
        go('/climbs');
      }}>Delete climb</button>
    </div>
  );
}
