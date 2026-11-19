import { useMemo, useState } from 'react';
import { db, refreshClimbStatus, uid } from '../db/db';
import type { Attempt, Climb, Discipline, GradeSystem, Result, Session, StyleTag } from '../db/types';
import { DISCIPLINES, DISCIPLINE_LABEL, RESULTS, RESULT_LABEL, STYLE_TAGS } from '../db/types';
import { prefSystemFor, isValidGrade, fromIndex } from '../lib/grades/grades';
import { useSettings } from '../settings';
import { toast, useGrade } from '../hooks';
import { Autocomplete, Chips, GradePicker, Sheet, Stepper, type ACOption } from './ui';
import { climbIndex, totalGoes, type Dataset } from '../lib/stats';

/**
 * Quick-log sheet: pick or create a climb, tap a result, adjust goes, save.
 * Also used to edit an existing attempt.
 */
export function AttemptSheet({
  session, ds, attempt, onClose,
}: {
  session: Session;
  ds: Dataset;
  attempt?: Attempt;
  onClose: () => void;
}) {
  const { grades } = useSettings();
  const fmt = useGrade();
  const existing = attempt ? ds.climbs.find((c) => c.id === attempt.climbId) : undefined;
  const defaultDisc: Discipline = existing?.discipline ?? session.disciplines[0] ?? 'boulder';

  const [climbId, setClimbId] = useState<string | undefined>(existing?.id);
  const [name, setName] = useState(existing?.name ?? '');
  const [discipline, setDiscipline] = useState<Discipline>(defaultDisc);
  const [system, setSystem] = useState<GradeSystem>(existing?.gradeSystem ?? prefSystemFor(defaultDisc, grades));
  const [grade, setGrade] = useState(existing?.grade ?? '');
  const [styles, setStyles] = useState<StyleTag[]>(existing?.styles ?? []);
  const [sector, setSector] = useState(existing?.sector ?? '');
  const [result, setResult] = useState<Result | undefined>(attempt?.result);
  const [goes, setGoes] = useState(attempt?.goes ?? 1);
  const [highPoint, setHighPoint] = useState(attempt?.highPoint ?? '');
  const [notes, setNotes] = useState(attempt?.notes ?? '');
  const [more, setMore] = useState(false);

  // Suggestions: climbs at this location first, most recently tried first
  const options: ACOption[] = useMemo(() => {
    const last = new Map<string, string>();
    for (const a of ds.attempts) if ((last.get(a.climbId) ?? '') < a.date) last.set(a.climbId, a.date);
    const locs = new Map(ds.locations.map((l) => [l.id, l]));
    return [...ds.climbs]
      .sort((a, b) => {
        const here = Number(b.locationId === session.locationId) - Number(a.locationId === session.locationId);
        if (here) return here;
        return (last.get(b.id) ?? '') < (last.get(a.id) ?? '') ? -1 : 1;
      })
      .map((c) => ({
        id: c.id,
        label: `${c.name} · ${fmt(c)}`,
        sub: [locs.get(c.locationId ?? '')?.name, c.sector, c.status === 'project' ? 'Project' : undefined].filter(Boolean).join(' · '),
      }));
  }, [ds, session.locationId]);

  const pick = (o: ACOption) => {
    const c = ds.climbs.find((x) => x.id === o.id);
    if (!c) return;
    setClimbId(c.id);
    setName(c.name);
    setDiscipline(c.discipline);
    setSystem(c.gradeSystem);
    setGrade(c.grade);
    setStyles(c.styles);
    setSector(c.sector ?? '');
  };

  // Scroll the grade chips to the grade of your most recent climb in this family
  const hint = useMemo(() => {
    const climbs = new Map(ds.climbs.map((c) => [c.id, c]));
    const recent = [...ds.attempts]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
      .map((a) => climbs.get(a.climbId))
      .find((c) => c && (c.discipline === 'boulder') === (discipline === 'boulder'));
    const idx = recent ? climbIndex(recent) : null;
    return idx == null ? undefined : fromIndex(idx, system);
  }, [ds, discipline, system]);

  const priorGoes = climbId ? totalGoes(ds.attempts.filter((a) => a.id !== attempt?.id), climbId) : 0;
  const isSendFirstGo = result === 'onsight' || result === 'flash';
  const unsent = result === 'attempt' || result === 'dog';
  const canSave = name.trim() && grade && isValidGrade(grade, system) && result;

  const save = async (again: boolean) => {
    if (!canSave || !result) return;
    let id = climbId;
    const climbFields: Partial<Climb> = {
      name: name.trim(), discipline, grade, gradeSystem: system, styles, sector: sector.trim() || undefined,
    };
    if (id && ds.climbs.some((c) => c.id === id)) {
      await db.climbs.update(id, climbFields);
    } else {
      id = uid();
      const loc = ds.locations.find((l) => l.id === session.locationId);
      await db.climbs.add({
        id, ...climbFields, locationId: session.locationId, rockType: loc?.rockType, status: 'project', createdAt: Date.now(),
      } as Climb);
    }
    const row: Attempt = {
      id: attempt?.id ?? uid(),
      sessionId: session.id,
      climbId: id,
      date: session.date,
      goes: isSendFirstGo ? 1 : goes,
      result,
      highPoint: unsent ? highPoint.trim() || undefined : undefined,
      notes: notes.trim() || undefined,
      createdAt: attempt?.createdAt ?? Date.now(),
    };
    await db.attempts.put(row);
    if (attempt && attempt.climbId !== id) await refreshClimbStatus(attempt.climbId);
    await refreshClimbStatus(id);
    const disc = new Set(session.disciplines);
    if (!disc.has(discipline)) await db.sessions.update(session.id, { disciplines: [...disc, discipline] });
    toast(`${name.trim()} · ${RESULT_LABEL[result]}`);
    if (again) {
      setClimbId(undefined); setName(''); setGrade(''); setResult(undefined); setGoes(1);
      setHighPoint(''); setNotes(''); setStyles([]); setSector('');
    } else onClose();
  };

  const remove = async () => {
    if (!attempt || !window.confirm('Delete this attempt?')) return;
    await db.attempts.delete(attempt.id);
    await refreshClimbStatus(attempt.climbId);
    onClose();
  };

  return (
    <Sheet title={attempt ? 'Edit attempt' : 'Log a climb'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          Climb
          <Autocomplete
            label="Climb name"
            value={name}
            onChange={(v) => { setName(v); setClimbId(undefined); }}
            options={options}
            onPick={pick}
            placeholder="Name, or pick a recent climb"
            showOnFocus={!attempt}
          />
          {climbId && <span className="field-hint">Existing climb{priorGoes ? ` · ${priorGoes} goes so far` : ''}. Editing grade/style updates the climb.</span>}
        </label>

        <Chips options={DISCIPLINES} value={discipline} labels={DISCIPLINE_LABEL} label="Discipline"
          onChange={(d: Discipline) => {
            setDiscipline(d);
            const famChanged = (d === 'boulder') !== (discipline === 'boulder');
            if (famChanged) { setSystem(prefSystemFor(d, grades)); setGrade(''); }
          }} />

        <GradePicker discipline={discipline} system={system} grade={grade} hint={hint} onChange={(g, s) => { setGrade(g); setSystem(s); }} />

        <fieldset>
          <legend>Result</legend>
          <div className="result-grid">
            {RESULTS.map((r) => (
              <button key={r} type="button" className="chip result" data-r={r} aria-pressed={result === r} onClick={() => setResult(r)}>
                {RESULT_LABEL[r]}
              </button>
            ))}
          </div>
          {isSendFirstGo && priorGoes > 0 && (
            <span className="field-hint">You've already logged {priorGoes} goes on this, so it's probably a redpoint.</span>
          )}
        </fieldset>

        {!isSendFirstGo && (
          <fieldset>
            <legend>Goes this session</legend>
            <Stepper value={goes} onChange={setGoes} label="goes" />
          </fieldset>
        )}

        {unsent && (
          <label className="field">
            High point
            <input value={highPoint} onChange={(e) => setHighPoint(e.target.value)} placeholder="e.g. crux, bolt 5, lip" />
          </label>
        )}

        <button type="button" className="btn ghost" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? 'Fewer details' : 'Style, sector & notes'}
        </button>
        {more && (
          <>
            <fieldset>
              <legend>Style</legend>
              <Chips multi options={STYLE_TAGS} value={styles} onChange={setStyles} label="Style tags" />
            </fieldset>
            <label className="field">Sector<input value={sector} onChange={(e) => setSector(e.target.value)} /></label>
            <label className="field">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </>
        )}

        <div className="row">
          <button type="button" className="btn big" style={{ flex: 1 }} disabled={!canSave} onClick={() => save(false)}>Save</button>
          {!attempt && <button type="button" className="btn big secondary" disabled={!canSave} onClick={() => save(true)}>Save + next</button>}
        </div>
        {attempt && <button type="button" className="btn danger" onClick={remove}>Delete attempt</button>}
      </div>
    </Sheet>
  );
}
