import { BOULDER_TABLE, ROUTE_TABLE } from './gradeTable';
import type { Discipline, GradeSystem } from '../../db/types';

export const BOULDER_SYSTEMS: GradeSystem[] = ['font', 'v'];
export const ROUTE_SYSTEMS: GradeSystem[] = ['french', 'uk', 'yds', 'uiaa'];

export interface GradePrefs {
  boulder: GradeSystem; // font | v
  sport: GradeSystem; // used for sport + top rope
  trad: GradeSystem; // used for trad + multi-pitch
}
export const DEFAULT_GRADE_PREFS: GradePrefs = { boulder: 'font', sport: 'french', trad: 'uk' };

export const isBoulder = (d: Discipline) => d === 'boulder';
export const isBoulderSystem = (s: GradeSystem) => s === 'font' || s === 'v';
export const systemsFor = (d: Discipline) => (isBoulder(d) ? BOULDER_SYSTEMS : ROUTE_SYSTEMS);

export function prefSystemFor(d: Discipline, prefs: GradePrefs): GradeSystem {
  if (d === 'boulder') return prefs.boulder;
  if (d === 'trad' || d === 'multipitch') return prefs.trad;
  return prefs.sport;
}

function column(system: GradeSystem): string[] {
  switch (system) {
    case 'font': return BOULDER_TABLE.map((r) => r.font);
    case 'v': return BOULDER_TABLE.map((r) => r.v);
    case 'french': return ROUTE_TABLE.map((r) => r.french);
    case 'yds': return ROUTE_TABLE.map((r) => r.yds);
    case 'uiaa': return ROUTE_TABLE.map((r) => r.uiaa);
    case 'uk': return ROUTE_TABLE.map((r) => r.uk);
  }
}

/** Number of rungs on the ladder used by this system. */
export const ladderSize = (system: GradeSystem) => column(system).length;

/** Distinct grades in difficulty order, for pickers. */
export function gradeList(system: GradeSystem): string[] {
  const out: string[] = [];
  for (const g of column(system)) if (!out.includes(g)) out.push(g);
  return out;
}

/** Canonical casing: Font upper-case letters, French lower-case, V upper. */
export function normalizeGrade(raw: string, system: GradeSystem): string {
  const g = raw.trim().replace(/\s+/g, ' ');
  switch (system) {
    case 'font': return g.toUpperCase();
    case 'v': return g.toUpperCase();
    case 'french': return g.toLowerCase();
    case 'yds': return g.toLowerCase();
    case 'uiaa': return g.toUpperCase();
    case 'uk': {
      const [adj, tech] = g.split(' ');
      return [adj?.toUpperCase(), tech?.toLowerCase()].filter(Boolean).join(' ');
    }
  }
}

/** Convert an original grade into the numeric index. Returns null if unknown. */
export function toIndex(grade: string, system: GradeSystem): number | null {
  if (!grade) return null;
  const g = normalizeGrade(grade, system);
  const col = column(system);
  if (system !== 'uk') {
    const i = col.indexOf(g);
    return i >= 0 ? i : null;
  }
  // UK: "E2 5c", "E2", "HVS", or "5c"
  const exact = col.indexOf(g);
  if (exact >= 0) return exact;
  const [a, b] = g.split(' ');
  const isTech = (s: string) => /^[1-7][abc]$/.test(s);
  const adj = a && !isTech(a) ? a : undefined;
  const tech = isTech(a ?? '') ? a : b;
  const rows = col.map((c, i) => ({ i, adj: c.split(' ')[0], tech: c.split(' ')[1] }));
  if (adj) {
    const byAdj = rows.filter((r) => r.adj === adj);
    if (byAdj.length) {
      if (tech) {
        // nearest tech grade among rows with that adjectival grade
        const t = techValue(tech);
        byAdj.sort((x, y) => Math.abs(techValue(x.tech) - t) - Math.abs(techValue(y.tech) - t));
        return byAdj[0].i;
      }
      return byAdj[Math.floor((byAdj.length - 1) / 2)].i;
    }
  }
  if (tech) {
    const byTech = rows.find((r) => r.tech === tech);
    if (byTech) return byTech.i;
  }
  return null;
}

function techValue(t: string): number {
  const m = /^([1-7])([abc])$/.exec(t);
  if (!m) return 0;
  return Number(m[1]) * 3 + 'abc'.indexOf(m[2]);
}

/** Convert an index (may be fractional) back to a grade in a system. */
export function fromIndex(index: number, system: GradeSystem): string {
  const col = column(system);
  const i = Math.max(0, Math.min(col.length - 1, Math.round(index)));
  return col[i];
}

/** Convert a grade from one system to another (same discipline family). */
export function convertGrade(grade: string, from: GradeSystem, to: GradeSystem): string | null {
  if (isBoulderSystem(from) !== isBoulderSystem(to)) return null;
  const i = toIndex(grade, from);
  return i == null ? null : fromIndex(i, to);
}

export function isValidGrade(grade: string, system: GradeSystem): boolean {
  return toIndex(grade, system) != null;
}

/** Display a climb's grade in the user's preferred system. */
export function displayGrade(
  c: { grade: string; gradeSystem: GradeSystem; discipline: Discipline },
  prefs: GradePrefs,
): string {
  const target = prefSystemFor(c.discipline, prefs);
  if (target === c.gradeSystem) return normalizeGrade(c.grade, c.gradeSystem);
  const conv = convertGrade(c.grade, c.gradeSystem, target);
  return conv ?? c.grade;
}

/** Label for an index on a discipline's ladder in the user's preferred system. */
export function indexLabel(index: number, d: Discipline, prefs: GradePrefs): string {
  return fromIndex(index, prefSystemFor(d, prefs));
}
