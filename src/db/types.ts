// ───────────────────────────────────────────────────────────────
// Sendlog data schema. Every record has a string `id` (UUID) and an
// optional `demo` flag so seeded demo data can be cleared in one go.
// Dates are local calendar dates stored as 'YYYY-MM-DD' strings.
// ───────────────────────────────────────────────────────────────

export type Discipline = 'boulder' | 'sport' | 'trad' | 'toprope' | 'multipitch';
export const DISCIPLINES: Discipline[] = ['boulder', 'sport', 'trad', 'toprope', 'multipitch'];
export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  boulder: 'Boulder',
  sport: 'Sport',
  trad: 'Trad',
  toprope: 'Top rope',
  multipitch: 'Multi-pitch',
};

export type StyleTag =
  | 'crimpy' | 'slopers' | 'overhang' | 'slab' | 'vertical' | 'roof'
  | 'crack' | 'technical' | 'powerful' | 'endurance';
export const STYLE_TAGS: StyleTag[] = [
  'crimpy', 'slopers', 'overhang', 'slab', 'vertical', 'roof',
  'crack', 'technical', 'powerful', 'endurance',
];

export type Result = 'onsight' | 'flash' | 'redpoint' | 'repeat' | 'attempt' | 'toprope' | 'dog';
export const RESULTS: Result[] = ['onsight', 'flash', 'redpoint', 'repeat', 'attempt', 'toprope', 'dog'];
export const RESULT_LABEL: Record<Result, string> = {
  onsight: 'Onsight',
  flash: 'Flash',
  redpoint: 'Redpoint',
  repeat: 'Repeat',
  attempt: 'Attempt',
  toprope: 'Top rope',
  dog: 'Dog',
};
/** Results that count as a (lead/clean) send of the climb. */
export const SEND_RESULTS: Result[] = ['onsight', 'flash', 'redpoint', 'repeat'];
/** Results that count as a *first* send, used for level/pyramid stats. */
export const FIRST_SEND_RESULTS: Result[] = ['onsight', 'flash', 'redpoint'];

export type IndoorOutdoor = 'indoor' | 'outdoor';

export interface Location {
  id: string;
  name: string; // crag or gym
  area: string;
  country: string;
  type: IndoorOutdoor;
  rockType?: string;
  lat?: number;
  lng?: number;
  createdAt: number;
  demo?: boolean;
}

export interface Conditions {
  tempC?: number;
  rock?: string; // e.g. "dry", "greasy"
  weather?: string; // e.g. "sunny", "overcast"
  notes?: string;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  startedAt?: number; // epoch ms (live sessions)
  endedAt?: number;
  active?: boolean; // currently running session
  locationId?: string;
  type: IndoorOutdoor;
  disciplines: Discipline[];
  durationMin?: number;
  conditions?: Conditions;
  energy?: number; // 1–5
  rating?: number; // 1–5
  notes?: string;
  createdAt: number;
  demo?: boolean;
}

export interface Climb {
  id: string;
  name: string;
  locationId?: string;
  sector?: string;
  discipline: Discipline;
  grade: string; // original grade as entered, e.g. "7A", "E2 5c"
  gradeSystem: GradeSystem;
  styles: StyleTag[];
  rockType?: string;
  lengthM?: number;
  liked?: 'liked' | 'disliked';
  likeNotes?: string;
  stars?: number; // 0–3
  beta?: string;
  status: 'project' | 'sent';
  createdAt: number;
  demo?: boolean;
}

export interface Attempt {
  id: string;
  sessionId: string;
  climbId: string;
  date: string; // copied from session for fast range queries
  goes: number;
  result: Result;
  highPoint?: string;
  notes?: string;
  createdAt: number;
  demo?: boolean;
}

export type TrainingType = 'strength' | 'fingerboard' | 'power' | 'endurance' | 'mobility' | 'antagonist' | 'yoga';
export const TRAINING_TYPES: TrainingType[] = [
  'strength', 'fingerboard', 'power', 'endurance', 'mobility', 'antagonist', 'yoga',
];

export type Metric = 'reps' | 'weightKg' | 'addedKg' | 'hangSec' | 'restSec';
export const METRIC_LABEL: Record<Metric, string> = {
  reps: 'Reps',
  weightKg: 'Weight kg',
  addedKg: 'Added kg',
  hangSec: 'Hang s',
  restSec: 'Rest s',
};

export interface Exercise {
  id: string;
  name: string;
  category: TrainingType;
  metrics: Metric[];
  createdAt: number;
}

export interface ExerciseEntry {
  exerciseId: string;
  sets: number;
  reps?: number;
  weightKg?: number;
  addedKg?: number;
  hangSec?: number;
  restSec?: number;
  notes?: string;
}

export interface TrainingSession {
  id: string;
  date: string;
  type: TrainingType;
  exercises: ExerciseEntry[];
  rpe?: number; // 1–10
  durationMin?: number;
  notes?: string;
  createdAt: number;
  demo?: boolean;
}

export interface Template {
  id: string;
  name: string;
  type: TrainingType;
  exercises: ExerciseEntry[];
  createdAt: number;
}

export interface Media {
  id: string;
  ownerType: 'session' | 'climb';
  ownerId: string;
  kind: 'image' | 'video';
  mime: string;
  name?: string;
  size: number;
  blob: Blob;
  createdAt: number;
  demo?: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type GradeSystem = 'font' | 'v' | 'french' | 'uk' | 'yds' | 'uiaa';
export const GRADE_SYSTEM_LABEL: Record<GradeSystem, string> = {
  font: 'Font',
  v: 'V-scale',
  french: 'French',
  uk: 'UK trad',
  yds: 'YDS',
  uiaa: 'UIAA',
};
