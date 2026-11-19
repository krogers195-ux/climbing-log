import { useState } from 'react';
import { db, deleteSession, refreshClimbStatus } from '../db/db';
import type { Attempt, Discipline, Session } from '../db/types';
import { DISCIPLINES, DISCIPLINE_LABEL } from '../db/types';
import { useDataset, toast } from '../hooks';
import { prettyDate, todayISO } from '../lib/dates';
import { Chips, Empty, Rating, num } from '../components/ui';
import { LocationPicker, draftFromLocation, type LocationDraft } from '../components/LocationPicker';
import { MediaGallery } from '../components/Media';
import { AttemptSheet } from '../components/AttemptSheet';
import { AttemptRow, ensureLocation } from './Log';
import { go, href } from '../router';
import type { Dataset } from '../lib/stats';

export function SessionsPage() {
  const ds = useDataset();
  const [limit, setLimit] = useState(40);
  if (!ds) return null;
  const locs = new Map(ds.locations.map((l) => [l.id, l]));
  const sessions = [...ds.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Sessions</h1>
        <a className="btn" href={href('/log')}>+ New session</a>
      </div>
      {sessions.length === 0 ? (
        <Empty title="No sessions yet"><p>Start one from the Log tab.</p></Empty>
      ) : (
        <div className="card">
          <ul className="list">
            {sessions.slice(0, limit).map((s) => {
              const atts = ds.attempts.filter((a) => a.sessionId === s.id);
              const sends = atts.filter((a) => ['onsight', 'flash', 'redpoint', 'repeat'].includes(a.result)).length;
              return (
                <li key={s.id}>
                  <a className="list-item" href={href(`/session/${s.id}`)}>
                    <span className="grow">
                      <div className="title">{locs.get(s.locationId ?? '')?.name ?? 'Unknown location'}{s.active ? ' · live' : ''}</div>
                      <div className="sub">{prettyDate(s.date)} · {s.disciplines.map((d) => DISCIPLINE_LABEL[d]).join(', ')} · {atts.length} climbs · {sends} sends</div>
                    </span>
                    {s.rating && <span className="badge" aria-label={`Rated ${s.rating} of 5`}>{'★'.repeat(s.rating)}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
          {sessions.length > limit && <button className="btn secondary block" onClick={() => setLimit(limit + 40)}>Show more</button>}
        </div>
      )}
    </div>
  );
}

function SessionEditor({ s, ds, onDone }: { s: Session; ds: Dataset; onDone: () => void }) {
  const [loc, setLoc] = useState<LocationDraft>(draftFromLocation(ds.locations.find((l) => l.id === s.locationId)));
  const [date, setDate] = useState(s.date);
  const [disciplines, setDisciplines] = useState<Discipline[]>(s.disciplines);
  const [duration, setDuration] = useState(String(s.durationMin ?? ''));
  const [temp, setTemp] = useState(String(s.conditions?.tempC ?? ''));
  const [rock, setRock] = useState(s.conditions?.rock ?? '');
  const [weather, setWeather] = useState(s.conditions?.weather ?? '');
  const [cnotes, setCnotes] = useState(s.conditions?.notes ?? '');
  const [energy, setEnergy] = useState(s.energy);
  const [rating, setRating] = useState(s.rating);
  const [notes, setNotes] = useState(s.notes ?? '');
  const save = async () => {
    const locationId = await ensureLocation(loc);
    await db.transaction('rw', db.sessions, db.attempts, async () => {
      await db.sessions.update(s.id, {
        date, locationId, type: loc.type, disciplines, durationMin: num(duration), energy, rating,
        conditions: { tempC: num(temp), rock: rock || undefined, weather: weather || undefined, notes: cnotes || undefined },
        notes: notes.trim() || undefined,
      });
      if (date !== s.date) await db.attempts.where('sessionId').equals(s.id).modify({ date });
    });
    toast('Session updated');
    onDone();
  };
  return (
    <div className="card stack">
      <LocationPicker ds={ds} value={loc} onChange={setLoc} />
      <div className="form-grid two">
        <label className="field">Date<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || s.date)} /></label>
        <label className="field">Duration (min)<input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
      </div>
      <fieldset><legend>Disciplines</legend><Chips multi options={DISCIPLINES} value={disciplines} onChange={setDisciplines} labels={DISCIPLINE_LABEL} label="Disciplines" /></fieldset>
      <div className="form-grid two">
        <label className="field">Temp (°C)<input inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} /></label>
        <label className="field">Rock / friction<input value={rock} onChange={(e) => setRock(e.target.value)} /></label>
        <label className="field">Weather<input value={weather} onChange={(e) => setWeather(e.target.value)} /></label>
        <label className="field">Conditions notes<input value={cnotes} onChange={(e) => setCnotes(e.target.value)} /></label>
      </div>
      <fieldset><legend>Energy</legend><Rating value={energy} onChange={setEnergy} label="Energy" symbol="●" /></fieldset>
      <fieldset><legend>Session rating</legend><Rating value={rating} onChange={setRating} label="Session rating" /></fieldset>
      <label className="field">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="row">
        <button className="btn" onClick={save}>Save</button>
        <button className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export function SessionDetail({ id }: { id?: string }) {
  const ds = useDataset();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editAtt, setEditAtt] = useState<Attempt | null>(null);
  if (!ds) return null;
  const s = ds.sessions.find((x) => x.id === id);
  if (!s) return <Empty title="Session not found"><a href={href('/sessions')}>All sessions</a></Empty>;
  const loc = ds.locations.find((l) => l.id === s.locationId);
  const atts = ds.attempts.filter((a) => a.sessionId === s.id).sort((a, b) => a.createdAt - b.createdAt);
  const c = s.conditions ?? {};
  const cond = [c.tempC != null ? `${c.tempC}°C` : '', c.weather, c.rock, c.notes].filter(Boolean).join(' · ');
  return (
    <div className="stack">
      <div>
        <a href={href('/sessions')}>← Sessions</a>
        <h1 style={{ marginTop: 8 }}>{loc ? <a href={href(`/location/${loc.id}`)} style={{ color: 'inherit', textDecoration: 'none' }}>{loc.name}</a> : 'Session'}</h1>
        <div className="row">
          <span className="muted">{prettyDate(s.date)}</span>
          <span className="badge outline">{s.type}</span>
          {s.disciplines.map((d) => <span key={d} className="badge">{DISCIPLINE_LABEL[d]}</span>)}
          {s.active && <a className="live-pill" href={href('/log')}>Live — open</a>}
        </div>
      </div>
      {editing ? (
        <SessionEditor s={s} ds={ds} onDone={() => setEditing(false)} />
      ) : (
        <div className="card stack">
          <div className="stat-row">
            <div className="stat"><div className="label">Rating</div><div className="value">{s.rating ? `${s.rating}/5` : '–'}</div></div>
            <div className="stat"><div className="label">Energy</div><div className="value">{s.energy ? `${s.energy}/5` : '–'}</div></div>
            <div className="stat"><div className="label">Duration</div><div className="value">{s.durationMin ? `${s.durationMin}m` : '–'}</div></div>
            <div className="stat"><div className="label">Goes</div><div className="value">{atts.reduce((p, a) => p + a.goes, 0)}</div></div>
          </div>
          {cond && <p style={{ margin: 0 }}><strong>Conditions:</strong> {cond}</p>}
          {s.notes && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.notes}</p>}
          <div className="row"><button className="btn secondary" onClick={() => setEditing(true)}>Edit session</button></div>
        </div>
      )}
      <div className="card">
        <div className="row between"><h2>Climbs</h2><button className="btn sm" onClick={() => setAdding(true)}>+ Add climb</button></div>
        {atts.length ? (
          <ul className="list">{atts.map((a) => <li key={a.id}><AttemptRow a={a} ds={ds} onClick={() => setEditAtt(a)} /></li>)}</ul>
        ) : <p className="muted">No climbs logged.</p>}
      </div>
      <div className="card">
        <h2>Photos & videos</h2>
        <MediaGallery ownerType="session" ownerId={s.id} />
      </div>
      <button
        className="btn danger"
        onClick={async () => {
          if (!window.confirm('Delete this session, its attempts and media? This cannot be undone.')) return;
          const climbIds = [...new Set(atts.map((a) => a.climbId))];
          await deleteSession(s.id);
          for (const cid of climbIds) await refreshClimbStatus(cid);
          toast('Session deleted');
          go('/sessions');
        }}
      >
        Delete session
      </button>
      {adding && <AttemptSheet session={s} ds={ds} onClose={() => setAdding(false)} />}
      {editAtt && <AttemptSheet session={s} ds={ds} attempt={editAtt} onClose={() => setEditAtt(null)} />}
    </div>
  );
}
