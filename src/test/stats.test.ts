import { describe, expect, it } from 'vitest';
import type { Attempt, Climb, Result, Session, StyleTag } from '../db/types';
import {
  computeSends, consistentGrade, goesToSend, hardest, levelSummary, progressByMonth, pyramid,
  styleAnalysis, styleSuggestions, type Dataset,
} from '../lib/stats';
import { toIndex } from '../lib/grades/grades';

let n = 0;
const climb = (grade: string, styles: StyleTag[] = [], discipline: Climb['discipline'] = 'boulder'): Climb => ({
  id: `c${n++}`, name: `Climb ${n}`, discipline, grade, gradeSystem: discipline === 'boulder' ? 'font' : 'french',
  styles, status: 'project', createdAt: 0,
});
const session = (date: string, type: 'indoor' | 'outdoor' = 'outdoor'): Session => ({ id: `s-${date}-${type}`, date, type, disciplines: ['boulder'], createdAt: 0 });
const att = (c: Climb, s: Session, result: Result, goes = 1): Attempt => ({ id: `a${n++}`, climbId: c.id, sessionId: s.id, date: s.date, result, goes, createdAt: n });
const dataset = (climbs: Climb[], sessions: Session[], attempts: Attempt[]): Dataset => ({ climbs, sessions, attempts, locations: [], training: [], exercises: [] });

describe('level calculations', () => {
  const s1 = session('2026-01-10');
  const s2 = session('2026-02-10');
  const s3 = session('2026-10-01');
  const s4 = session('2026-11-01', 'indoor');
  const project = climb('7B', ['overhang']);
  const flash = climb('7A', ['crimpy']);
  const onsightRoute = climb('7a', ['vertical'], 'sport');
  const easy = [climb('6C'), climb('6C+'), climb('6B')];
  const attempts = [
    att(project, s1, 'attempt', 5),
    att(project, s2, 'attempt', 4),
    att(project, s3, 'redpoint', 3),
    att(project, s4, 'repeat', 1),
    att(flash, s3, 'flash'),
    att(onsightRoute, s1, 'onsight'),
    ...easy.map((c) => att(c, s4, 'flash')),
  ];
  const ds = dataset([project, flash, onsightRoute, ...easy], [s1, s2, s3, s4], attempts);

  it('counts goes to send across sessions', () => {
    const sends = computeSends(ds);
    const p = sends.find((x) => x.climbId === project.id)!;
    expect(p.style).toBe('redpoint');
    expect(p.goes).toBe(12);
    expect(p.date).toBe('2026-10-01');
    expect(sends.filter((x) => x.climbId === project.id)).toHaveLength(1); // repeat not double-counted
  });

  it('finds hardest per style and window', () => {
    const sends = computeSends(ds);
    expect(hardest(sends, 'redpoint')?.index).toBe(toIndex('7B', 'font'));
    expect(hardest(sends, 'flash')?.index).toBe(toIndex('7A', 'font'));
    const rows = levelSummary(sends, '2026-11-19');
    const b = rows.find((r) => r.discipline === 'boulder')!;
    expect(b.last90.redpoint?.climb.id).toBe(project.id);
    const sport = rows.find((r) => r.discipline === 'sport')!;
    expect(sport.allTime.onsight?.index).toBe(toIndex('7a', 'french'));
    expect(sport.last90.onsight).toBeNull(); // sent in January
  });

  it('consistent grade = 3rd hardest send in the window', () => {
    const sends = computeSends(ds).filter((s) => s.climb.discipline === 'boulder');
    // boulder sends: 7B, 7A, 6C+, 6C, 6B → 3rd hardest is 6C+
    expect(consistentGrade(sends)).toBe(toIndex('6C+', 'font'));
    expect(consistentGrade(sends.slice(0, 2))).toBeNull();
  });

  it('respects filters', () => {
    expect(computeSends(ds, { setting: 'indoor' })).toHaveLength(3);
    expect(computeSends(ds, { from: '2026-10-01', to: '2026-10-31' })).toHaveLength(2);
    expect(computeSends(ds, { disciplines: ['sport'] })).toHaveLength(1);
  });

  it('builds pyramid, progress and goes-to-send', () => {
    const sends = computeSends(ds, { disciplines: ['boulder'] });
    const pyr = pyramid(sends);
    expect(pyr[0].index).toBe(toIndex('7B', 'font'));
    expect(pyr.reduce((p, r) => p + r.total, 0)).toBe(5);
    expect(pyr.find((r) => r.index === toIndex('7A', 'font'))?.flash).toBe(1);
    const prog = progressByMonth(sends);
    expect(prog.map((p) => p.month)).toEqual(['2026-10', '2026-11']);
    expect(prog[0].max).toBe(toIndex('7B', 'font'));
    expect(goesToSend(sends)).toEqual([{ index: toIndex('7B', 'font'), avgGoes: 12, count: 1 }]);
  });

  it('produces style analysis and plain suggestions', () => {
    const cs: Climb[] = [];
    const as: Attempt[] = [];
    const s = session('2026-11-01');
    for (const g of ['7A', '7A+', '7B']) { const c = climb(g, ['overhang']); cs.push(c); as.push(att(c, s, 'flash')); }
    for (const g of ['6B', '6B+', '6C']) { const c = climb(g, ['slab']); cs.push(c); as.push(att(c, s, 'flash')); }
    const rows = styleAnalysis(dataset(cs, [s], as));
    const slab = rows.find((r) => r.style === 'slab')!;
    const over = rows.find((r) => r.style === 'overhang')!;
    expect(slab.delta! < 0 && over.delta! > 0).toBe(true);
    const tips = styleSuggestions(rows);
    expect(tips[0]).toMatch(/You send slab about 4 grades below overhang/);
  });
});
