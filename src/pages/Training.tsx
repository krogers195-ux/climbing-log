import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db/db';
import type { Exercise, ExerciseEntry, Metric, TrainingSession, TrainingType } from '../db/types';
import { METRIC_LABEL, TRAINING_TYPES } from '../db/types';
import { toast } from '../hooks';
import { prettyDate, todayISO } from '../lib/dates';
import { Chips, Empty, Sheet, num } from '../components/ui';
import { go, href } from '../router';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const TYPE_LABEL = Object.fromEntries(TRAINING_TYPES.map((t) => [t, cap(t)])) as Record<TrainingType, string>;
const ALL_METRICS: Metric[] = ['reps', 'weightKg', 'addedKg', 'hangSec', 'restSec'];

export function summariseEntry(e: ExerciseEntry) {
  const parts = [`${e.sets}×${e.reps ?? ''}`.replace(/×$/, ' sets')];
  if (e.hangSec) parts.push(`${e.hangSec}s`);
  if (e.weightKg) parts.push(`${e.weightKg}kg`);
  if (e.addedKg) parts.push(`+${e.addedKg}kg`);
  if (e.restSec) parts.push(`rest ${e.restSec}s`);
  return parts.join(' · ');
}

export function TrainingPage() {
  const sessions = useLiveQuery(() => db.training.orderBy('date').reverse().toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  const [limit, setLimit] = useState(30);
  if (!sessions || !exercises || !templates) return null;
  const ex = new Map(exercises.map((e) => [e.id, e]));
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Training</h1>
        <div className="row">
          <a className="btn secondary" href={href('/exercises')}>Exercise library</a>
          <a className="btn" href={href('/train/new')}>+ New session</a>
        </div>
      </div>
      {templates.length > 0 && (
        <div className="card">
          <h2>Templates</h2>
          <ul className="list">
            {templates.map((t) => (
              <li key={t.id} className="list-item">
                <span className="grow">
                  <div className="title">{t.name}</div>
                  <div className="sub">{TYPE_LABEL[t.type]} · {t.exercises.map((e) => ex.get(e.exerciseId)?.name).filter(Boolean).join(', ')}</div>
                </span>
                <a className="btn sm" href={href(`/train/new?template=${t.id}`)}>Use</a>
                <button className="btn ghost sm" onClick={async () => { if (window.confirm(`Delete template “${t.name}”?`)) await db.templates.delete(t.id); }}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sessions.length === 0 ? <Empty title="No training logged yet" /> : (
        <div className="card">
          <ul className="list">
            {sessions.slice(0, limit).map((s) => (
              <li key={s.id}>
                <a className="list-item" href={href(`/train/${s.id}`)}>
                  <span className="grow">
                    <div className="title">{TYPE_LABEL[s.type]} · {prettyDate(s.date)}</div>
                    <div className="sub">{s.exercises.map((e) => ex.get(e.exerciseId)?.name ?? '?').join(', ')}</div>
                  </span>
                  {s.rpe && <span className="badge">RPE {s.rpe}</span>}
                </a>
              </li>
            ))}
          </ul>
          {sessions.length > limit && <button className="btn secondary block" onClick={() => setLimit(limit + 30)}>Show more</button>}
        </div>
      )}
    </div>
  );
}

function EntryEditor({ entry, exercises, onChange, onRemove }: { entry: ExerciseEntry; exercises: Exercise[]; onChange: (e: ExerciseEntry) => void; onRemove: () => void }) {
  const ex = exercises.find((e) => e.id === entry.exerciseId);
  const metrics = ex?.metrics ?? ALL_METRICS;
  const field = (m: Metric) => (
    <label key={m} className="field">
      {METRIC_LABEL[m]}
      <input inputMode="decimal" value={entry[m] ?? ''} onChange={(e) => onChange({ ...entry, [m]: num(e.target.value) })} />
    </label>
  );
  return (
    <div className="card plain stack">
      <div className="row">
        <select aria-label="Exercise" style={{ flex: 1, minWidth: 0 }} value={entry.exerciseId} onChange={(e) => onChange({ ...entry, exerciseId: e.target.value })}>
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="btn ghost sm" onClick={onRemove} aria-label="Remove exercise">Remove</button>
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}>
        <label className="field">Sets<input inputMode="numeric" value={entry.sets ?? ''} onChange={(e) => onChange({ ...entry, sets: num(e.target.value) ?? 0 })} /></label>
        {metrics.map(field)}
      </div>
    </div>
  );
}

export function TrainingEditor({ id }: { id: string }) {
  const isNew = id === 'new' || id.startsWith('new');
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  const [s, setS] = useState<TrainingSession | null>(null);
  const [rpe, setRpe] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [saveTpl, setSaveTpl] = useState(false);

  useEffect(() => {
    (async () => {
      if (isNew) {
        const tplId = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('template');
        const tpl = tplId ? await db.templates.get(tplId) : undefined;
        setS({ id: uid(), date: todayISO(), type: tpl?.type ?? 'strength', exercises: tpl ? structuredClone(tpl.exercises) : [], createdAt: Date.now() });
      } else {
        const t = await db.training.get(id);
        if (t) {
          setS(t);
          setRpe(t.rpe ? String(t.rpe) : '');
          setDuration(t.durationMin ? String(t.durationMin) : '');
        }
      }
    })();
  }, [id]);

  if (!exercises || !templates) return null;
  if (!s) return isNew ? null : <Empty title="Training session not found" />;

  const applyTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) setS({ ...s, type: tpl.type, exercises: structuredClone(tpl.exercises) });
  };
  const addExercise = () => {
    const first = exercises.find((e) => e.category === s.type) ?? exercises[0];
    if (first) setS({ ...s, exercises: [...s.exercises, { exerciseId: first.id, sets: 3 }] });
  };
  const save = async () => {
    await db.training.put({ ...s, rpe: num(rpe), durationMin: num(duration) });
    toast('Training saved');
    go('/train');
  };
  return (
    <div className="stack">
      <a href={href('/train')}>← Training</a>
      <h1>{isNew ? 'New training session' : 'Edit training'}</h1>
      <div className="card stack">
        {isNew && templates.length > 0 && (
          <label className="field">
            Start from a template
            <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">—</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
        <label className="field">Date<input type="date" value={s.date} max={todayISO()} onChange={(e) => setS({ ...s, date: e.target.value || s.date })} /></label>
        <fieldset><legend>Type</legend><Chips options={TRAINING_TYPES} value={s.type} labels={TYPE_LABEL} onChange={(type: TrainingType) => setS({ ...s, type })} label="Training type" /></fieldset>
      </div>
      <h2>Exercises</h2>
      {s.exercises.map((e, i) => (
        <EntryEditor
          key={i}
          entry={e}
          exercises={exercises}
          onChange={(ne) => setS({ ...s, exercises: s.exercises.map((x, j) => (j === i ? ne : x)) })}
          onRemove={() => setS({ ...s, exercises: s.exercises.filter((_, j) => j !== i) })}
        />
      ))}
      <button className="btn secondary" onClick={addExercise}>+ Add exercise</button>
      <div className="card stack">
        <fieldset>
          <legend>RPE (effort 1–10)</legend>
          <Chips options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']} value={rpe} onChange={(v: string) => setRpe(rpe === v ? '' : v)} label="RPE" />
        </fieldset>
        <label className="field">Duration (min)<input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
        <label className="field">Notes<textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value || undefined })} /></label>
      </div>
      <div className="row">
        <button className="btn big" style={{ flex: 1 }} onClick={save}>Save</button>
        <button className="btn big secondary" disabled={!s.exercises.length} onClick={() => setSaveTpl(true)}>Save as template</button>
      </div>
      {!isNew && (
        <button className="btn danger" onClick={async () => {
          if (!window.confirm('Delete this training session?')) return;
          await db.training.delete(s.id);
          go('/train');
        }}>Delete</button>
      )}
      {saveTpl && <TemplateNameSheet onClose={() => setSaveTpl(false)} onSave={async (name) => {
        await db.templates.add({ id: uid(), name, type: s.type, exercises: s.exercises, createdAt: Date.now() });
        toast(`Template “${name}” saved`);
        setSaveTpl(false);
      }} />}
    </div>
  );
}

function TemplateNameSheet({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Sheet title="Save as template" onClose={onClose}>
      <div className="stack">
        <label className="field">Template name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monday fingers" /></label>
        <button className="btn big" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save template</button>
      </div>
    </Sheet>
  );
}

export function ExerciseLibrary() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const [edit, setEdit] = useState<Exercise | null>(null);
  if (!exercises) return null;
  const byCat = TRAINING_TYPES.map((t) => ({ t, list: exercises.filter((e) => e.category === t) })).filter((g) => g.list.length);
  return (
    <div className="stack">
      <a href={href('/train')}>← Training</a>
      <div className="page-head">
        <h1>Exercise library</h1>
        <button className="btn" onClick={() => setEdit({ id: uid(), name: '', category: 'strength', metrics: ['reps'], createdAt: Date.now() })}>+ New exercise</button>
      </div>
      {byCat.map(({ t, list }) => (
        <div className="card" key={t}>
          <h3>{TYPE_LABEL[t]}</h3>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id}>
                <button className="list-item" style={{ width: '100%', background: 'none', border: 0, font: 'inherit', textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={() => setEdit(e)}>
                  <span className="grow"><div className="title">{e.name}</div><div className="sub">{e.metrics.map((m) => METRIC_LABEL[m]).join(', ')}</div></span>
                  <span className="muted">Edit</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {edit && <ExerciseSheet ex={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ExerciseSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const [f, setF] = useState(ex);
  const existing = useLiveQuery(() => db.exercises.get(ex.id), [ex.id]);
  return (
    <Sheet title={existing ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <div className="stack">
        <label className="field">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <fieldset><legend>Category</legend><Chips options={TRAINING_TYPES} value={f.category} labels={TYPE_LABEL} onChange={(category: TrainingType) => setF({ ...f, category })} label="Category" /></fieldset>
        <fieldset><legend>What do you record?</legend><Chips multi options={ALL_METRICS} value={f.metrics} labels={METRIC_LABEL} onChange={(metrics: Metric[]) => setF({ ...f, metrics })} label="Metrics" /></fieldset>
        <button className="btn big" disabled={!f.name.trim()} onClick={async () => { await db.exercises.put({ ...f, name: f.name.trim() }); onClose(); }}>Save</button>
        {existing && (
          <button className="btn danger" onClick={async () => {
            const used = await db.training.filter((t) => t.exercises.some((e) => e.exerciseId === ex.id)).count();
            if (!window.confirm(used ? `Used in ${used} training sessions — those entries will show as “?”. Delete anyway?` : 'Delete this exercise?')) return;
            await db.exercises.delete(ex.id);
            onClose();
          }}>Delete exercise</button>
        )}
      </div>
    </Sheet>
  );
}
