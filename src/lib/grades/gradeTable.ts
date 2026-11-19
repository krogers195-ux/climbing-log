// ───────────────────────────────────────────────────────────────
// GRADE CONVERSION TABLE — edit this file to tweak conversions.
//
// Each row is one step on a numeric difficulty index (the row number).
// Stats and charts compare climbs using that index, so a climb logged
// as "V4" and one logged as "6B" land on the same rung.
//
// • Bouldering and routes use separate ladders (index 0 = easiest).
// • When a grade appears on several rows (e.g. V4 = 6B and 6B+), parsing
//   uses the FIRST matching row. Put the most typical equivalent first.
// • UK trad cells are "ADJECTIVAL TECH" (e.g. "E2 5c"). You can log
//   "E2 5c", "E2" or "HVS" — the parser finds the best row.
// • Add rows, change cells or add aliases freely; keep columns aligned.
// ───────────────────────────────────────────────────────────────

export interface BoulderRow { font: string; v: string }
export interface RouteRow { french: string; yds: string; uiaa: string; uk: string }

export const BOULDER_TABLE: BoulderRow[] = [
  { font: '3', v: 'VB' },
  { font: '4', v: 'V0' },
  { font: '4+', v: 'V0' },
  { font: '5', v: 'V1' },
  { font: '5+', v: 'V2' },
  { font: '6A', v: 'V3' },
  { font: '6A+', v: 'V3' },
  { font: '6B', v: 'V4' },
  { font: '6B+', v: 'V4' },
  { font: '6C', v: 'V5' },
  { font: '6C+', v: 'V5' },
  { font: '7A', v: 'V6' },
  { font: '7A+', v: 'V7' },
  { font: '7B', v: 'V8' },
  { font: '7B+', v: 'V8' },
  { font: '7C', v: 'V9' },
  { font: '7C+', v: 'V10' },
  { font: '8A', v: 'V11' },
  { font: '8A+', v: 'V12' },
  { font: '8B', v: 'V13' },
  { font: '8B+', v: 'V14' },
  { font: '8C', v: 'V15' },
  { font: '8C+', v: 'V16' },
  { font: '9A', v: 'V17' },
];

export const ROUTE_TABLE: RouteRow[] = [
  { french: '3', yds: '5.4', uiaa: 'III', uk: 'D 3a' },
  { french: '4a', yds: '5.5', uiaa: 'IV', uk: 'VD 3c' },
  { french: '4b', yds: '5.6', uiaa: 'IV+', uk: 'S 4a' },
  { french: '4c', yds: '5.7', uiaa: 'V-', uk: 'HS 4b' },
  { french: '5a', yds: '5.8', uiaa: 'V', uk: 'VS 4c' },
  { french: '5b', yds: '5.9', uiaa: 'V+', uk: 'HVS 5a' },
  { french: '5c', yds: '5.10a', uiaa: 'VI-', uk: 'HVS 5b' },
  { french: '6a', yds: '5.10b', uiaa: 'VI', uk: 'E1 5b' },
  { french: '6a+', yds: '5.10c', uiaa: 'VI+', uk: 'E1 5c' },
  { french: '6b', yds: '5.10d', uiaa: 'VII-', uk: 'E2 5c' },
  { french: '6b+', yds: '5.11a', uiaa: 'VII', uk: 'E3 5c' },
  { french: '6c', yds: '5.11b', uiaa: 'VII+', uk: 'E3 6a' },
  { french: '6c+', yds: '5.11c', uiaa: 'VIII-', uk: 'E4 6a' },
  { french: '7a', yds: '5.11d', uiaa: 'VIII', uk: 'E4 6b' },
  { french: '7a+', yds: '5.12a', uiaa: 'VIII+', uk: 'E5 6b' },
  { french: '7b', yds: '5.12b', uiaa: 'IX-', uk: 'E5 6c' },
  { french: '7b+', yds: '5.12c', uiaa: 'IX', uk: 'E6 6b' },
  { french: '7c', yds: '5.12d', uiaa: 'IX+', uk: 'E6 6c' },
  { french: '7c+', yds: '5.13a', uiaa: 'X-', uk: 'E7 6c' },
  { french: '8a', yds: '5.13b', uiaa: 'X-', uk: 'E7 7a' },
  { french: '8a+', yds: '5.13c', uiaa: 'X', uk: 'E8 6c' },
  { french: '8b', yds: '5.13d', uiaa: 'X+', uk: 'E8 7a' },
  { french: '8b+', yds: '5.14a', uiaa: 'XI-', uk: 'E9 7a' },
  { french: '8c', yds: '5.14b', uiaa: 'XI', uk: 'E9 7b' },
  { french: '8c+', yds: '5.14c', uiaa: 'XI+', uk: 'E10 7a' },
  { french: '9a', yds: '5.14d', uiaa: 'XII-', uk: 'E10 7b' },
  { french: '9a+', yds: '5.15a', uiaa: 'XII', uk: 'E11 7a' },
  { french: '9b', yds: '5.15b', uiaa: 'XII+', uk: 'E11 7b' },
];
