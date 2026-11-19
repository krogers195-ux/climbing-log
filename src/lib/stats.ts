// Pure functions that turn raw records into dashboard stats.
// Everything here is synchronous and side-effect free so it is easy to test.

import type {
  Attempt, Climb, Discipline, Exercise, Location, Result, Session, StyleTag, TrainingSession,
} from '../db/types';
import { FIRST_SEND_RESULTS, SEND_RESULTS, STYLE_TAGS } from '../db/types';
import { toIndex } from './grades/grades';
import { addDays, monthKey, weekStart } from './dates';

export interface Dataset {
  sessions: Session[];
  climbs: Climb[];
  attempts: Attempt[];
  locations: Location[];
  training: TrainingSession[];
  exercises: Exercise[];
}

export interface Filters {
  from?: string;
  to?: string;
  disciplines?: Discipline[]; // empty/undefined = all
  setting?: 'all' | 'indoor' | 'outdoor';
  locationId?: string;
}

export type Family = 'boulder' | 'route';
export const familyOf = (d: Discipline): Family => (d === 'boulder' ? 'boulder' : 'route');

export const climbIndex = (c: Climb) => toIndex(c.grade, c.gradeSystem);

const byDate = (a: Attempt, b: Attempt) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt;

/** Attempts that pass the filters. */
export function filterAttempts(ds: Dataset, f: Filters = {}): Attempt[] {
  const climbs = new Map(ds.climbs.map((c) => [c.id, c]));
  const sessions = new Map(ds.sessions.map((s) => [s.id, s]));
  return ds.attempts.filter((a) => {
    const c = climbs.get(a.climbId);
    if (!c) return false;
    if (f.from && a.date < f.from) return false;
    if (f.to && a.date > f.to) return false;
    if (f.disciplines?.length && !f.disciplines.includes(c.discipline)) return false;
    const s = sessions.get(a.sessionId);
    if (f.setting && f.setting !== 'all' && s && s.type !== f.setting) return false;
    if (f.locationId && (c.locationId ?? s?.locationId) !== f.locationId) return false;
    return true;
  });
}

export interface Send {
  climbId: string;
  climb: Climb;
  date: string;
  style: Result; // onsight | flash | redpoint
  index: number;
  goes: number; // total goes up to and including the send, across sessions
  sessionId: string;
}

/**
 * First send of each climb (onsight/flash/redpoint). Goes are summed from
 * ALL attempts on the climb up to the send, regardless of filters, so the
 * goes-to-send number is always correct. Filters then apply to the send date.
 */
export function computeSends(ds: Dataset, f: Filters = {}): Send[] {
  const allByClimb = new Map<string, Attempt[]>();
  for (const a of ds.attempts) {
    const list = allByClimb.get(a.climbId) ?? [];
    list.push(a);
    allByClimb.set(a.climbId, list);
  }
  const allowed = new Set(filterAttempts(ds, f).map((a) => a.id));
  const climbs = new Map(ds.climbs.map((c) => [c.id, c]));
  const sends: Send[] = [];
  for (const [climbId, list] of allByClimb) {
    const climb = climbs.get(climbId);
    if (!climb) continue;
    const index = climbIndex(climb);
    if (index == null) continue;
    list.sort(byDate);
    let goes = 0;
    for (const a of list) {
      goes += Math.max(1, a.goes || 1);
      if (FIRST_SEND_RESULTS.includes(a.result)) {
        if (allowed.has(a.id)) {
          sends.push({ climbId, climb, date: a.date, style: a.result, index, goes, sessionId: a.sessionId });
        }
        break;
      }
    }
  }
  return sends;
}

export interface Hardest { index: number; climb: Climb; date: string }

export function hardest(sends: Send[], style?: Result, since?: string): Hardest | null {
  let best: Hardest | null = null;
  for (const s of sends) {
    if (style && s.style !== style) continue;
    if (since && s.date < since) continue;
    if (!best || s.index > best.index || (s.index === best.index && s.date > best.date)) {
      best = { index: s.index, climb: s.climb, date: s.date };
    }
  }
  return best;
}

/**
 * "Consistent grade": the hardest grade G such that at least `min` climbs
 * at G or harder were sent within the window. Returns null if fewer than
 * `min` sends.
 */
export function consistentGrade(sends: Send[], min = 3): number | null {
  if (sends.length < min) return null;
  const idx = sends.map((s) => s.index).sort((a, b) => b - a);
  return idx[min - 1];
}

export interface LevelRow {
  discipline: Discipline;
  allTime: Record<'onsight' | 'flash' | 'redpoint', Hardest | null>;
  last90: Record<'onsight' | 'flash' | 'redpoint', Hardest | null>;
  consistent90: number | null;
  sendCount: number;
}

export function levelSummary(sends: Send[], today: string): LevelRow[] {
  const since = addDays(today, -90);
  const disciplines = [...new Set(sends.map((s) => s.climb.discipline))];
  const order: Discipline[] = ['boulder', 'sport', 'trad', 'toprope', 'multipitch'];
  disciplines.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return disciplines.map((d) => {
    const ds = sends.filter((s) => s.climb.discipline === d);
    const recent = ds.filter((s) => s.date >= since && s.date <= today);
    return {
      discipline: d,
      allTime: { onsight: hardest(ds, 'onsight'), flash: hardest(ds, 'flash'), redpoint: hardest(ds, 'redpoint') },
      last90: { onsight: hardest(recent, 'onsight'), flash: hardest(recent, 'flash'), redpoint: hardest(recent, 'redpoint') },
      consistent90: consistentGrade(recent),
      sendCount: ds.length,
    };
  });
}

export interface PyramidRow { index: number; onsight: number; flash: number; redpoint: number; total: number }

export function pyramid(sends: Send[]): PyramidRow[] {
  const map = new Map<number, PyramidRow>();
  for (const s of sends) {
    const row = map.get(s.index) ?? { index: s.index, onsight: 0, flash: 0, redpoint: 0, total: 0 };
    if (s.style === 'onsight' || s.style === 'flash' || s.style === 'redpoint') row[s.style]++;
    row.total++;
    map.set(s.index, row);
  }
  return [...map.values()].sort((a, b) => b.index - a.index);
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface ProgressPoint { month: string; max: number; median: number; count: number }

export function progressByMonth(sends: Send[]): ProgressPoint[] {
  const map = new Map<string, number[]>();
  for (const s of sends) {
    const k = monthKey(s.date);
    map.set(k, [...(map.get(k) ?? []), s.index]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, xs]) => ({ month, max: Math.max(...xs), median: median(xs), count: xs.length }));
}

export interface GoesRow { index: number; avgGoes: number; count: number }

export function goesToSend(sends: Send[]): GoesRow[] {
  const map = new Map<number, number[]>();
  for (const s of sends) {
    if (s.style !== 'redpoint') continue;
    map.set(s.index, [...(map.get(s.index) ?? []), s.goes]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, xs]) => ({ index, avgGoes: Math.round((xs.reduce((p, x) => p + x, 0) / xs.length) * 10) / 10, count: xs.length }));
}

/** Total goes logged on a climb across all sessions. */
export function totalGoes(attempts: Attempt[], climbId: string) {
  return attempts.filter((a) => a.climbId === climbId).reduce((p, a) => p + Math.max(1, a.goes || 1), 0);
}

// ── Styles ─────────────────────────────────────────────────────────

export interface StyleRow {
  style: StyleTag;
  tried: number; // distinct climbs tried
  sent: number;
  sendRate: number; // 0–1
  delta: number | null; // avg grade of sends relative to your average send (in grades)
}

export function styleAnalysis(ds: Dataset, f: Filters = {}): StyleRow[] {
  const atts = filterAttempts(ds, f);
  const sends = computeSends(ds, f);
  const climbs = new Map(ds.climbs.map((c) => [c.id, c]));
  const triedIds = new Set(atts.map((a) => a.climbId));
  const sentIds = new Set(
    atts.filter((a) => SEND_RESULTS.includes(a.result)).map((a) => a.climbId),
  );
  // Normalise each send against the mean of its family (boulder vs route)
  const famMean: Record<Family, number> = { boulder: 0, route: 0 };
  for (const fam of ['boulder', 'route'] as Family[]) {
    const xs = sends.filter((s) => familyOf(s.climb.discipline) === fam).map((s) => s.index);
    famMean[fam] = xs.length ? xs.reduce((p, x) => p + x, 0) / xs.length : 0;
  }
  return STYLE_TAGS.map((style) => {
    const tried = [...triedIds].filter((id) => climbs.get(id)?.styles.includes(style));
    const sent = tried.filter((id) => sentIds.has(id));
    const styleSends = sends.filter((s) => s.climb.styles.includes(style));
    const delta = styleSends.length
      ? styleSends.reduce((p, s) => p + (s.index - famMean[familyOf(s.climb.discipline)]), 0) / styleSends.length
      : null;
    return {
      style,
      tried: tried.length,
      sent: sent.length,
      sendRate: tried.length ? sent.length / tried.length : 0,
      delta: delta == null ? null : Math.round(delta * 10) / 10,
    };
  });
}

const TIPS: Record<StyleTag, string> = {
  crimpy: 'add max hangs on a 20mm edge twice a week',
  slopers: 'work body tension and open-hand grip, and pick cooler conditions',
  overhang: 'build core strength and try more steep limit boulders',
  slab: 'practise footwork drills and trusting smears on easy slabs',
  vertical: 'focus on precise footwork and hip positioning on vertical walls',
  roof: 'train front-lever progressions and toe-hooks',
  crack: 'spend a session drilling hand and finger jams on easy cracks',
  technical: 'repeat climbs to refine sequences, and try silent feet drills',
  powerful: 'add limit bouldering and campus ladders',
  endurance: 'add 4×4s or ARC sessions to build your aerobic base',
};

const grades = (n: number) => {
  const r = Math.round(Math.abs(n) * 2) / 2;
  return `${r} grade${r === 1 ? '' : 's'}`;
};

/** Plain-language suggestions from the style analysis. */
export function styleSuggestions(rows: StyleRow[]): string[] {
  const out: string[] = [];
  const graded = rows.filter((r) => r.delta != null && r.sent >= 3);
  if (graded.length >= 2) {
    const sorted = [...graded].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    const strong = sorted[0];
    const weak = sorted[sorted.length - 1];
    const gap = (strong.delta ?? 0) - (weak.delta ?? 0);
    if (gap >= 0.5) {
      out.push(`You send ${weak.style} about ${grades(gap)} below ${strong.style}.`);
    }
  }
  for (const r of graded) {
    if ((r.delta ?? 0) <= -0.75) {
      out.push(
        `${cap(r.style)} is a relative weakness: your sends average ${grades(r.delta ?? 0)} below your norm. Try to ${TIPS[r.style]}.`,
      );
    }
  }
  for (const r of rows) {
    if (r.tried >= 4 && r.sendRate < 0.4) {
      out.push(
        `You send only ${Math.round(r.sendRate * 100)}% of the ${r.style} climbs you try. Pick a few ${r.style} climbs a grade below your limit to build confidence.`,
      );
    }
  }
  const anyTried = rows.some((r) => r.tried > 0);
  if (anyTried) {
    const never = rows.filter((r) => r.tried === 0).slice(0, 2);
    for (const r of never) out.push(`No ${r.style} climbs logged yet. Mixing some in keeps you well-rounded.`);
  }
  const best = graded.filter((r) => (r.delta ?? 0) >= 0.75).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0];
  if (best) out.push(`${cap(best.style)} is your strength: sends average ${grades(best.delta ?? 0)} above your norm. Use it to pick your next hard project.`);
  return out;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ── Volume & load ──────────────────────────────────────────────────

export interface WeekRow {
  week: string;
  climbs: number;
  goes: number;
  sends: number;
  trainingMin: number;
  trainingSets: number;
  avgRating: number | null;
}

export function weeklyVolume(ds: Dataset, f: Filters = {}): WeekRow[] {
  const atts = filterAttempts(ds, f);
  const map = new Map<string, { climbs: Set<string>; goes: number; sends: number; tMin: number; tSets: number; ratings: number[] }>();
  const get = (w: string) => {
    let r = map.get(w);
    if (!r) {
      r = { climbs: new Set(), goes: 0, sends: 0, tMin: 0, tSets: 0, ratings: [] };
      map.set(w, r);
    }
    return r;
  };
  for (const a of atts) {
    const r = get(weekStart(a.date));
    r.climbs.add(a.climbId);
    r.goes += Math.max(1, a.goes || 1);
    if (SEND_RESULTS.includes(a.result)) r.sends++;
  }
  const sessionIds = new Set(atts.map((a) => a.sessionId));
  for (const s of ds.sessions) {
    if (sessionIds.has(s.id) && s.rating) get(weekStart(s.date)).ratings.push(s.rating);
  }
  for (const t of ds.training) {
    if (f.from && t.date < f.from) continue;
    if (f.to && t.date > f.to) continue;
    const r = get(weekStart(t.date));
    r.tMin += t.durationMin ?? 0;
    r.tSets += t.exercises.reduce((p, e) => p + (e.sets || 0), 0);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, r]) => ({
      week,
      climbs: r.climbs.size,
      goes: r.goes,
      sends: r.sends,
      trainingMin: r.tMin,
      trainingSets: r.tSets,
      avgRating: r.ratings.length ? Math.round((r.ratings.reduce((p, x) => p + x, 0) / r.ratings.length) * 10) / 10 : null,
    }));
}

export interface DayLoad { date: string; climbing: number; training: number }

/** Daily load for the heat map: goes climbed + training sets. */
export function dailyLoad(ds: Dataset, from: string, to: string, f: Filters = {}): Map<string, DayLoad> {
  const out = new Map<string, DayLoad>();
  const get = (d: string) => {
    let r = out.get(d);
    if (!r) out.set(d, (r = { date: d, climbing: 0, training: 0 }));
    return r;
  };
  for (const a of filterAttempts(ds, { ...f, from, to })) get(a.date).climbing += Math.max(1, a.goes || 1);
  for (const t of ds.training) {
    if (t.date < from || t.date > to) continue;
    get(t.date).training += t.exercises.reduce((p, e) => p + (e.sets || 0), 0) || 1;
  }
  return out;
}

// ── Training ───────────────────────────────────────────────────────

export interface ExercisePoint { date: string; maxReps?: number; maxAdded?: number; maxHang?: number; maxWeight?: number }

export function exerciseProgress(training: TrainingSession[], exerciseId: string, f: Filters = {}): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  const sorted = [...training].sort((a, b) => (a.date < b.date ? -1 : 1));
  const mx = (a: number | undefined, b: number | undefined) => (b == null ? a : a == null ? b : Math.max(a, b));
  for (const t of sorted) {
    if (f.from && t.date < f.from) continue;
    if (f.to && t.date > f.to) continue;
    const entries = t.exercises.filter((e) => e.exerciseId === exerciseId);
    if (!entries.length) continue;
    const p: ExercisePoint = { date: t.date };
    for (const e of entries) {
      p.maxReps = mx(p.maxReps, e.reps);
      p.maxAdded = mx(p.maxAdded, e.addedKg);
      p.maxHang = mx(p.maxHang, e.hangSec);
      p.maxWeight = mx(p.maxWeight, e.weightKg);
    }
    out.push(p);
  }
  return out;
}

// ── Projects & locations ───────────────────────────────────────────

export interface ProjectRow { climb: Climb; goes: number; sessions: number; lastTried: string | null; highPoint?: string }

export function projects(ds: Dataset): ProjectRow[] {
  return ds.climbs
    .filter((c) => c.status === 'project')
    .map((climb) => {
      const atts = ds.attempts.filter((a) => a.climbId === climb.id).sort(byDate);
      const last = atts[atts.length - 1];
      return {
        climb,
        goes: atts.reduce((p, a) => p + Math.max(1, a.goes || 1), 0),
        sessions: new Set(atts.map((a) => a.sessionId)).size,
        lastTried: last?.date ?? null,
        highPoint: [...atts].reverse().find((a) => a.highPoint)?.highPoint,
      };
    })
    .sort((a, b) => ((b.lastTried ?? '') < (a.lastTried ?? '') ? -1 : 1));
}

export interface LocationStats {
  location: Location;
  sessions: number;
  climbs: number;
  sends: number;
  hardestBoulder: Hardest | null;
  hardestRoute: Hardest | null;
  lastVisit: string | null;
}

export function locationStats(ds: Dataset): LocationStats[] {
  const sends = computeSends(ds);
  return ds.locations.map((location) => {
    const sess = ds.sessions.filter((s) => s.locationId === location.id);
    const climbs = ds.climbs.filter((c) => c.locationId === location.id);
    const ls = sends.filter((s) => s.climb.locationId === location.id);
    return {
      location,
      sessions: sess.length,
      climbs: climbs.length,
      sends: ls.length,
      hardestBoulder: hardest(ls.filter((s) => s.climb.discipline === 'boulder')),
      hardestRoute: hardest(ls.filter((s) => s.climb.discipline !== 'boulder')),
      lastVisit: sess.map((s) => s.date).sort().pop() ?? null,
    };
  });
}
