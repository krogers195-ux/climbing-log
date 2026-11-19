import { useEffect, useState } from 'react';
import { db, uid } from '../db/db';
import type { Attempt, Discipline, Session } from '../db/types';
import { DISCIPLINES, DISCIPLINE_LABEL, RESULT_LABEL } from '../db/types';
import { useDataset, toast, useGrade } from '../hooks';
import { todayISO, prettyDate } from '../lib/dates';
import { Chips, Rating, Sheet, num } from '../components/ui';
import { AttemptSheet } from '../components/AttemptSheet';
import { LocationPicker, draftFromLocation, type LocationDraft } from '../components/LocationPicker';
import { MediaGallery } from '../components/Media';
import { go, href } from '../router';
import type { Dataset } from '../lib/stats';

/** Create the location if it's new, return its id. */
export async function ensureLocation(d: LocationDraft): Promise<string | undefined> {
  if (d.id) {
    await db.locations.update(d.id, { type: d.type });
    return d.id;
  }
  if (!d.name.trim()) return undefined;
  const id = uid();
  await db.locations.add({ id, name: d.name.trim(), area: d.area.trim(), country: d.country.trim(), type: d.type, createdAt: Date.now() });
  return id;
}

function StartSession({ ds }: { ds: Dataset }) {
  const lastSession = [...ds.sessions].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastLoc = ds.locations.find((l) => l.id === lastSession?.locationId);
  const [loc, setLoc] = useState<LocationDraft>(draftFromLocation(lastLoc));
  const [disciplines, setDisciplines] = useState<Discipline[]>(lastSession?.disciplines ?? ['boulder']);
  const [date, setDate] = useState(todayISO());

  // When a known location is picked, default disciplines from the last visit there
  useEffect(() => {
    if (!loc.id) return;
    const prev = [...ds.sessions].filter((s) => s.locationId === loc.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (prev) setDisciplines(prev.disciplines);
  }, [loc.id]);

  const start = async () => {
    const locationId = await ensureLocation(loc);
    const isToday = date === todayISO();
    const s: Session = {
      id: uid(), date, locationId, type: loc.type, disciplines: disciplines.length ? disciplines : ['boulder'],
      active: true, startedAt: isToday ? Date.now() : undefined, createdAt: Date.now(),
    };
    await db.sessions.add(s);
    toast('Session started');
  };

  return (
    <div className="stack">
      <h1>Start a session</h1>
      <div className="card stack">
        <LocationPicker ds={ds} value={loc} onChange={setLoc} />
        <fieldset>
          <legend>Discipline</legend>
          <Chips multi options={DISCIPLINES} value={disciplines} onChange={setDisciplines} labels={DISCIPLINE_LABEL} label="Disciplines" />
        </fieldset>
        <label className="field">
          Date
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          {date !== todayISO() && <span className="field-hint">Logging a past session.</span>}
        </label>
        <button className="btn big block" disabled={!loc.name.trim()} onClick={start}>Start session</button>
      </div>
      <p className="muted">Want to log training instead? <a href={href('/train/new')}>New training session</a></p>
    </div>
  );
}

function EndSession({ session, onClose }: { session: Session; onClose: () => void }) {
  const elapsed = session.startedAt ? Math.round((Date.now() - session.startedAt) / 60_000) : undefined;
  const [rating, setRating] = useState<number | undefined>(session.rating);
  const [energy, setEnergy] = useState<number | undefined>(session.energy);
  const [duration, setDuration] = useState(String(session.durationMin ?? elapsed ?? ''));
  const [temp, setTemp] = useState(String(session.conditions?.tempC ?? ''));
  const [rock, setRock] = useState(session.conditions?.rock ?? '');
  const [weather, setWeather] = useState(session.conditions?.weather ?? '');
  const [notes, setNotes] = useState(session.notes ?? '');
  const finish = async () => {
    await db.sessions.update(session.id, {
      active: false, endedAt: Date.now(), rating, energy, durationMin: num(duration),
      conditions: { tempC: num(temp), rock: rock || undefined, weather: weather || undefined },
      notes: notes.trim() || undefined,
    });
    toast('Session saved');
    onClose();
    go(`/session/${session.id}`);
  };
  return (
    <Sheet title="End session" onClose={onClose}>
      <div className="stack">
        <fieldset><legend>How was it?</legend><Rating value={rating} onChange={setRating} label="Session rating" /></fieldset>
        <fieldset><legend>Energy</legend><Rating value={energy} onChange={setEnergy} label="Energy level" symbol="●" /></fieldset>
        <div className="form-grid two">
          <label className="field">Duration (min)<input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
          <label className="field">Temp (°C)<input inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} /></label>
          <label className="field">Rock / friction<input value={rock} onChange={(e) => setRock(e.target.value)} placeholder="dry, greasy…" /></label>
          <label className="field">Weather<input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="sunny, windy…" /></label>
        </div>
        <label className="field">How did it go?<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <fieldset><legend>Photos & videos</legend><MediaGallery ownerType="session" ownerId={session.id} /></fieldset>
        <button className="btn big success block" onClick={finish}>Save & end session</button>
      </div>
    </Sheet>
  );
}

export function AttemptRow({ a, ds, onClick }: { a: Attempt; ds: Dataset; onClick?: () => void }) {
  const fmt = useGrade();
  const c = ds.climbs.find((x) => x.id === a.climbId);
  if (!c) return null;
  const send = ['onsight', 'flash', 'redpoint', 'repeat'].includes(a.result);
  const body = (
    <>
      <span className="grade">{fmt(c)}</span>
      <span className="grow">
        <div className="title">{c.name}</div>
        <div className="sub">{DISCIPLINE_LABEL[c.discipline]} · {a.goes} go{a.goes === 1 ? '' : 's'}{a.highPoint ? ` · high point: ${a.highPoint}` : ''}</div>
      </span>
      <span className={`badge ${a.result === 'flash' ? 'flash' : send ? 'send' : 'outline'}`}>{RESULT_LABEL[a.result]}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={onClick}>{body}</button>
  ) : (
    <a className="list-item" href={href(`/climb/${c.id}`)}>{body}</a>
  );
}

function LiveSession({ session, ds }: { session: Session; ds: Dataset }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Attempt | null>(null);
  const [ending, setEnding] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const loc = ds.locations.find((l) => l.id === session.locationId);
  const atts = ds.attempts.filter((a) => a.sessionId === session.id).sort((a, b) => b.createdAt - a.createdAt);
  const mins = session.startedAt ? Math.round((Date.now() - session.startedAt) / 60_000) : null;
  const sends = atts.filter((a) => ['onsight', 'flash', 'redpoint', 'repeat'].includes(a.result)).length;
  const goes = atts.reduce((p, a) => p + a.goes, 0);
  const cancel = async () => {
    if (!window.confirm(atts.length ? 'Discard this session and its climbs?' : 'Discard this session?')) return;
    await db.attempts.where('sessionId').equals(session.id).delete();
    await db.sessions.delete(session.id);
  };
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 style={{ marginBottom: 0 }}>{loc?.name ?? 'Session'}</h1>
          <span className="muted">{prettyDate(session.date)}{mins != null ? ` · ${mins} min` : ''} · {atts.length} climbs · {goes} goes · {sends} sends</span>
        </div>
      </div>
      <button className="btn big accent block" onClick={() => setAdding(true)} style={{ minHeight: 72, fontSize: '1.25rem' }}>+ Log a climb</button>
      <div className="card">
        {atts.length ? (
          <ul className="list">{atts.map((a) => <li key={a.id}><AttemptRow a={a} ds={ds} onClick={() => setEditing(a)} /></li>)}</ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Nothing logged yet. Tap “Log a climb” after each problem or route.</p>
        )}
      </div>
      <button className="btn big success block" onClick={() => setEnding(true)}>End session</button>
      <button className="btn ghost" onClick={cancel}>Discard session</button>
      {adding && <AttemptSheet session={session} ds={ds} onClose={() => setAdding(false)} />}
      {editing && <AttemptSheet session={session} ds={ds} attempt={editing} onClose={() => setEditing(null)} />}
      {ending && <EndSession session={session} onClose={() => setEnding(false)} />}
    </div>
  );
}

export default function LogPage() {
  const ds = useDataset();
  if (!ds) return null;
  const active = ds.sessions.find((s) => s.active);
  return active ? <LiveSession session={active} ds={ds} /> : <StartSession ds={ds} />;
}
