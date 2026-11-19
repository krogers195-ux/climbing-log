import { describe, expect, it } from 'vitest';
import { convertGrade, displayGrade, fromIndex, gradeList, isValidGrade, normalizeGrade, toIndex } from '../lib/grades/grades';
import { BOULDER_TABLE, ROUTE_TABLE } from '../lib/grades/gradeTable';

describe('grade conversion', () => {
  it('maps Font and V to the same index', () => {
    expect(toIndex('7A', 'font')).toBe(toIndex('V6', 'v'));
    expect(convertGrade('6C', 'font', 'v')).toBe('V5');
    expect(convertGrade('V4', 'v', 'font')).toBe('6B');
  });

  it('is case-insensitive', () => {
    expect(toIndex('6b+', 'font')).toBe(toIndex('6B+', 'font'));
    expect(toIndex('7A', 'french')).toBe(toIndex('7a', 'french'));
    expect(normalizeGrade('e2 5C', 'uk')).toBe('E2 5c');
  });

  it('converts French ↔ YDS ↔ UIAA', () => {
    expect(convertGrade('7a', 'french', 'yds')).toBe('5.11d');
    expect(convertGrade('5.12a', 'yds', 'french')).toBe('7a+');
    expect(convertGrade('6a', 'french', 'uiaa')).toBe('VI');
  });

  it('parses UK trad: full, adjectival-only, and tech-only', () => {
    expect(toIndex('E2 5c', 'uk')).toBe(toIndex('6b', 'french'));
    expect(toIndex('HVS', 'uk')).not.toBeNull();
    expect(toIndex('E1 5a', 'uk')).toBe(toIndex('E1 5b', 'uk')); // nearest tech within E1
    expect(isValidGrade('E2', 'uk')).toBe(true);
    expect(isValidGrade('Z9', 'uk')).toBe(false);
  });

  it('rejects unknown grades and cross-family conversions', () => {
    expect(toIndex('9Z', 'font')).toBeNull();
    expect(convertGrade('7A', 'font', 'french')).toBeNull();
  });

  it('round-trips every row in each system', () => {
    for (const s of ['font', 'v'] as const) {
      for (const g of gradeList(s)) expect(fromIndex(toIndex(g, s)!, s)).toBe(g);
    }
    for (const s of ['french', 'yds', 'uiaa', 'uk'] as const) {
      for (const g of gradeList(s)) expect(fromIndex(toIndex(g, s)!, s)).toBe(g);
    }
  });

  it('indexes increase monotonically down the table', () => {
    BOULDER_TABLE.forEach((r, i) => expect(toIndex(r.font, 'font')).toBe(i));
    ROUTE_TABLE.forEach((r, i) => expect(toIndex(r.french, 'french')).toBe(i));
  });

  it('clamps out-of-range indexes', () => {
    expect(fromIndex(-5, 'font')).toBe('3');
    expect(fromIndex(999, 'v')).toBe('V17');
  });

  it('displays in the preferred system', () => {
    const prefs = { boulder: 'v', sport: 'yds', trad: 'uk' } as const;
    expect(displayGrade({ grade: '7A', gradeSystem: 'font', discipline: 'boulder' }, prefs)).toBe('V6');
    expect(displayGrade({ grade: '6b', gradeSystem: 'french', discipline: 'trad' }, prefs)).toBe('E2 5c');
  });
});
