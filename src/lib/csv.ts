import type { Dataset } from './stats';
import { RESULT_LABEL, DISCIPLINE_LABEL } from '../db/types';

const cell = (v: unknown) => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

/** One row per attempt, joined with its climb, session and location. */
export function climbingCSV(ds: Dataset): string {
  const climbs = new Map(ds.climbs.map((c) => [c.id, c]));
  const sessions = new Map(ds.sessions.map((s) => [s.id, s]));
  const locs = new Map(ds.locations.map((l) => [l.id, l]));
  const header = [
    'date', 'climb', 'discipline', 'grade', 'grade_system', 'result', 'goes', 'high_point', 'attempt_notes',
    'styles', 'sector', 'crag_or_gym', 'area', 'country', 'indoor_outdoor', 'stars', 'liked', 'status',
    'session_rating', 'energy', 'session_notes',
  ];
  const rows = [...ds.attempts]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((a) => {
      const c = climbs.get(a.climbId);
      const s = sessions.get(a.sessionId);
      const l = locs.get(c?.locationId ?? s?.locationId ?? '');
      return [
        a.date, c?.name, c ? DISCIPLINE_LABEL[c.discipline] : '', c?.grade, c?.gradeSystem, RESULT_LABEL[a.result],
        a.goes, a.highPoint, a.notes, c?.styles, c?.sector, l?.name, l?.area, l?.country, s?.type,
        c?.stars, c?.liked, c?.status, s?.rating, s?.energy, s?.notes,
      ];
    });
  return toCSV([header, ...rows]);
}

/** One row per exercise entry in training sessions. */
export function trainingCSV(ds: Dataset): string {
  const ex = new Map(ds.exercises.map((e) => [e.id, e]));
  const header = ['date', 'type', 'exercise', 'sets', 'reps', 'weight_kg', 'added_kg', 'hang_s', 'rest_s', 'rpe', 'duration_min', 'notes'];
  const rows: unknown[][] = [];
  for (const t of [...ds.training].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const e of t.exercises) {
      rows.push([t.date, t.type, ex.get(e.exerciseId)?.name ?? e.exerciseId, e.sets, e.reps, e.weightKg, e.addedKg, e.hangSec, e.restSec, t.rpe, t.durationMin, e.notes ?? t.notes]);
    }
  }
  return toCSV([header, ...rows]);
}
