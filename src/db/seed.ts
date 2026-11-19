// Realistic-ish demo data: a year of UK gym bouldering + lead, a Font trip,
// a Spanish sport trip and a Magic Wood trip, plus twice-weekly training.
// Grades for named outdoor climbs are approximate — it's demo data.
import type {
  Attempt, Climb, Discipline, GradeSystem, Location, Media, Result, Session, StyleTag, TrainingSession,
} from './types';
import { db as defaultDb, type SendlogDB } from './db';
import { gradeList, toIndex } from '../lib/grades/grades';
import { addDays, todayISO } from '../lib/dates';

// Small deterministic RNG so the demo looks the same every time.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spec { name: string; grade: string; styles: StyleTag[]; sector?: string; lengthM?: number; stars?: number; beta?: string; liked?: 'liked' | 'disliked'; likeNotes?: string }

const FONT_BAS_CUVIER: Spec[] = [
  { name: 'La Marie-Rose', grade: '6A', styles: ['vertical', 'technical'], sector: 'Bas Cuvier', stars: 3, beta: 'High left foot, rock over onto the sloper, trust it.', liked: 'liked', likeNotes: 'Historic classic, perfect friction' },
  { name: 'Le Coin Chaud', grade: '5+', styles: ['slab', 'technical'], sector: 'Bas Cuvier', stars: 2 },
  { name: 'La Prestat', grade: '6B', styles: ['slopers', 'vertical'], sector: 'Bas Cuvier', stars: 2 },
  { name: "L'Abbatoir", grade: '7A', styles: ['slopers', 'powerful'], sector: 'Bas Cuvier', stars: 3, beta: 'Heel hook right, slap to the lip. Bring two pads.' },
  { name: 'Le Carnage', grade: '7A+', styles: ['overhang', 'powerful'], sector: 'Bas Cuvier', stars: 3 },
];
const FONT_ISATIS: Spec[] = [
  { name: 'La Science Friction', grade: '6B+', styles: ['slab', 'slopers'], sector: 'Isatis', stars: 2, liked: 'disliked', likeNotes: 'Terrifying smears, felt sandbagged' },
  { name: 'Le Toit du Cul de Chien', grade: '6C', styles: ['roof', 'powerful'], sector: 'Isatis', stars: 2 },
  { name: 'Duel', grade: '6C+', styles: ['crimpy', 'vertical'], sector: 'Isatis', stars: 3 },
  { name: 'Lune de Miel', grade: '6A+', styles: ['slab', 'technical'], sector: 'Isatis', stars: 1 },
  { name: "L'Arête de Châtaignier", grade: '7A', styles: ['technical', 'slopers'], sector: 'Isatis', stars: 3 },
];
const MAGIC_WOOD: Spec[] = [
  { name: 'Intro', grade: '6C', styles: ['crimpy', 'vertical'], sector: 'Riverbed', stars: 2 },
  { name: 'Riverbed', grade: '7A+', styles: ['overhang', 'powerful'], sector: 'Riverbed', stars: 3, beta: 'Undercling to the gaston, big move to the jug.', liked: 'liked', likeNotes: 'Steep, powerful and above the river' },
  { name: 'Spirit of Wood', grade: '7A', styles: ['crimpy', 'technical'], sector: 'Foresta', stars: 3 },
  { name: 'Bügeleisen', grade: '6B+', styles: ['slopers', 'overhang'], sector: 'Foresta', stars: 2 },
  { name: 'Mystic Stone', grade: '7B', styles: ['crimpy', 'overhang', 'powerful'], sector: 'Foresta', stars: 3, beta: 'Left hand pinch, right toe-hook, cross to the crimp rail.' },
  { name: 'Slabtastic', grade: '6C+', styles: ['slab', 'technical'], sector: 'Bruno', stars: 1, liked: 'disliked', likeNotes: 'Wet streak, never felt solid' },
  { name: 'Black Magic', grade: '7B+', styles: ['roof', 'powerful', 'crimpy'], sector: 'Bruno', stars: 3 },
];
const SIURANA: Spec[] = [
  { name: 'Esperó Primavera', grade: '6a+', styles: ['vertical', 'technical'], sector: 'El Pati', lengthM: 25, stars: 2 },
  { name: 'Grau de Bruixes', grade: '6b', styles: ['crimpy', 'vertical'], sector: 'El Pati', lengthM: 28, stars: 2 },
  { name: 'La Fura', grade: '6c', styles: ['overhang', 'endurance'], sector: "L'Olla", lengthM: 30, stars: 3 },
  { name: 'Placa Seca', grade: '6b+', styles: ['slab', 'technical'], sector: "L'Olla", lengthM: 22, stars: 1 },
  { name: 'Tufa Crack', grade: '7a', styles: ['overhang', 'endurance'], sector: 'Can Melitón', lengthM: 32, stars: 3, beta: 'Kneebar rest at the second tufa, clip from the jug.' },
  { name: 'Mal de Panxa', grade: '7a+', styles: ['crimpy', 'powerful'], sector: 'Can Melitón', lengthM: 26, stars: 2 },
];
const MARGALEF: Spec[] = [
  { name: 'Pockets & Dreams', grade: '6c+', styles: ['overhang', 'crimpy'], sector: 'Laboratori', lengthM: 18, stars: 2 },
  { name: 'Conglomerat', grade: '6b', styles: ['vertical', 'technical'], sector: 'Laboratori', lengthM: 20, stars: 2 },
  { name: 'Racó Fosc', grade: '7b', styles: ['overhang', 'endurance', 'powerful'], sector: 'Racó de la Finestra', lengthM: 24, stars: 3, beta: 'Mono at bolt 4 — go left hand. Shake on the big jug before the crux.' },
];

const DEMO_PHOTO_SVG = (title: string, hue: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#FBF5EC"/>
  <circle cx="930" cy="190" r="90" fill="#FBD271"/>
  <path d="M0 640 L260 330 L420 480 L640 210 L900 520 L1200 360 L1200 800 L0 800 Z" fill="${hue}"/>
  <path d="M0 720 L300 560 L560 650 L820 560 L1200 690 L1200 800 L0 800 Z" fill="#372516" opacity="0.85"/>
  <text x="60" y="110" font-family="Georgia, serif" font-size="64" fill="#372516">${title}</text>
  <text x="60" y="160" font-family="Arial, sans-serif" font-size="28" fill="#372516">Demo photo</text>
</svg>`;

export interface SeedData {
  locations: Location[];
  climbs: Climb[];
  sessions: Session[];
  attempts: Attempt[];
  training: TrainingSession[];
  media: Media[];
}

export function buildSeed(today = todayISO()): SeedData {
  const r = rng(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const now = Date.now();
  let counter = 0;
  const id = (p: string) => `demo-${p}-${(counter++).toString(36)}`;
  const t = (date: string, k = 0) => new Date(`${date}T10:00:00`).getTime() + k * 60_000;

  const loc = (name: string, area: string, country: string, type: 'indoor' | 'outdoor', rockType?: string, lat?: number, lng?: number): Location => ({
    id: id('loc'), name, area, country, type, rockType, lat, lng, createdAt: now, demo: true,
  });
  const gym = loc('Northside Bouldering Wall', 'Sheffield', 'United Kingdom', 'indoor', undefined, 53.38, -1.47);
  const basCuvier = loc('Bas Cuvier', 'Fontainebleau', 'France', 'outdoor', 'Sandstone', 48.447, 2.635);
  const isatis = loc('Franchard Isatis', 'Fontainebleau', 'France', 'outdoor', 'Sandstone', 48.411, 2.594);
  const magic = loc('Magic Wood', 'Averstal', 'Switzerland', 'outdoor', 'Gneiss', 46.52, 9.45);
  const siurana = loc('Siurana', 'Priorat, Catalonia', 'Spain', 'outdoor', 'Limestone', 41.258, 0.931);
  const margalef = loc('Margalef', 'Priorat, Catalonia', 'Spain', 'outdoor', 'Conglomerate', 41.287, 0.751);
  const locations = [gym, basCuvier, isatis, magic, siurana, margalef];

  const climbs: Climb[] = [];
  const sessions: Session[] = [];
  const attempts: Attempt[] = [];
  const training: TrainingSession[] = [];
  const media: Media[] = [];

  const mkClimb = (spec: Spec, l: Location, discipline: Discipline, system: GradeSystem): Climb => {
    const c: Climb = {
      id: id('climb'), name: spec.name, locationId: l.id, sector: spec.sector, discipline,
      grade: spec.grade, gradeSystem: system, styles: spec.styles, rockType: l.rockType,
      lengthM: spec.lengthM, stars: spec.stars, beta: spec.beta, liked: spec.liked, likeNotes: spec.likeNotes,
      status: 'project', createdAt: now, demo: true,
    };
    climbs.push(c);
    return c;
  };

  // Style "talent": positive = stronger. Slab and technical are weaknesses.
  const styleMod: Partial<Record<StyleTag, number>> = {
    overhang: 0.8, powerful: 0.7, crimpy: 0.4, roof: 0.3, endurance: 0.2,
    slab: -1.6, technical: -0.8, slopers: -0.3, vertical: 0,
  };
  const modFor = (c: Climb) => c.styles.reduce((p, s) => p + (styleMod[s] ?? 0), 0) / Math.max(1, c.styles.length);

  // Level progresses over the year (boulder index on Font ladder, route on French ladder)
  const start = addDays(today, -364);
  const progress = (date: string) => {
    const days = (new Date(date).getTime() - new Date(start).getTime()) / 86_400_000;
    return Math.max(0, Math.min(1, days / 364));
  };
  const boulderLevel = (d: string) => 8.5 + 2.6 * progress(d); // ~6B+ → ~7A
  const routeLevel = (d: string) => 10 + 3 * progress(d); // ~6b+ → ~7a

  const sent = new Set<string>();
  const sessionsOn = new Map<string, number>();

  /** Simulate one session's goes on a climb. */
  function tryClimb(s: Session, c: Climb, k: number) {
    if (sent.has(c.id) && r() > 0.15) return; // occasionally repeat sent climbs
    const idx = toIndex(c.grade, c.gradeSystem) ?? 0;
    const level = c.discipline === 'boulder' ? boulderLevel(s.date) : routeLevel(s.date);
    const diff = idx - (level + modFor(c));
    const prior = sessionsOn.get(c.id) ?? 0;
    sessionsOn.set(c.id, prior + 1);
    const isRoute = c.discipline !== 'boulder';
    let result: Result;
    let goes = 1;
    let highPoint: string | undefined;
    if (sent.has(c.id)) {
      result = 'repeat';
    } else if (prior === 0 && diff <= -2.5 && r() < 0.85) {
      result = isRoute && s.type === 'outdoor' ? 'onsight' : 'flash';
    } else if (prior === 0 && diff <= -0.5 && r() < 0.4) {
      result = isRoute && r() < 0.5 ? 'onsight' : 'flash';
    } else {
      const maxGoes = isRoute ? 3 : 6;
      const p = Math.max(0.04, Math.min(0.85, 0.32 - 0.13 * diff + 0.08 * prior));
      result = isRoute ? pick<Result>(['attempt', 'dog']) : 'attempt';
      goes = 0;
      for (let g = 1; g <= maxGoes; g++) {
        goes = g;
        if (g > 1 && r() < p) {
          result = 'redpoint';
          break;
        }
      }
      if (result !== 'redpoint') {
        highPoint = isRoute ? pick(['Bolt 4', 'Bolt 6', 'Crux', 'Last clip', 'Chains move']) : pick(['Start moves', 'Crux move', 'Lip', 'Top-out', 'Move 4']);
      }
    }
    if (['onsight', 'flash', 'redpoint', 'repeat'].includes(result)) {
      sent.add(c.id);
      c.status = 'sent';
    }
    attempts.push({
      id: id('att'), sessionId: s.id, climbId: c.id, date: s.date, goes, result, highPoint,
      notes: result === 'redpoint' && r() < 0.4 ? pick(['Finally stuck the crux!', 'Felt smooth once the beta clicked', 'Fell off the top twice before this']) : undefined,
      createdAt: t(s.date, k), demo: true,
    });
  }

  const mkSession = (date: string, l: Location, disciplines: Discipline[], extra: Partial<Session> = {}): Session => {
    const s: Session = {
      id: id('sess'), date, locationId: l.id, type: l.type, disciplines,
      durationMin: l.type === 'indoor' ? 90 + Math.round(r() * 60) : 180 + Math.round(r() * 180),
      energy: 2 + Math.floor(r() * 4), rating: 2 + Math.floor(r() * 4),
      createdAt: t(date), demo: true, ...extra,
    };
    sessions.push(s);
    return s;
  };

  // ── Trips ─────────────────────────────────────────────
  const trips = [
    { start: addDays(today, -235), days: 6, kind: 'font' as const },
    { start: addDays(today, -190), days: 7, kind: 'spain' as const },
    { start: addDays(today, -105), days: 6, kind: 'magic' as const },
  ];
  const inTrip = (d: string) => trips.some((tr) => d >= addDays(tr.start, -1) && d <= addDays(tr.start, tr.days));

  const fontClimbs = [...FONT_BAS_CUVIER.map((s) => mkClimb(s, basCuvier, 'boulder', 'font')), ...FONT_ISATIS.map((s) => mkClimb(s, isatis, 'boulder', 'font'))];
  const magicClimbs = MAGIC_WOOD.map((s) => mkClimb(s, magic, 'boulder', 'font'));
  const spainClimbs = [...SIURANA.map((s) => mkClimb(s, siurana, 'sport', 'french')), ...MARGALEF.map((s) => mkClimb(s, margalef, 'sport', 'french'))];

  for (const tr of trips) {
    for (let d = 0; d < tr.days; d++) {
      if (d === 3) continue; // rest day
      const date = addDays(tr.start, d);
      let l: Location;
      let pool: Climb[];
      let conditions: Session['conditions'];
      if (tr.kind === 'font') {
        l = d % 2 ? isatis : basCuvier;
        pool = fontClimbs.filter((c) => c.locationId === l.id);
        conditions = { tempC: 8 + Math.round(r() * 6), rock: pick(['Dry, crisp friction', 'Slightly damp in the morning', 'Perfect friction']), weather: pick(['Sunny, cold wind', 'Overcast', 'Clear and cold']) };
      } else if (tr.kind === 'spain') {
        l = d >= 4 ? margalef : siurana;
        pool = spainClimbs.filter((c) => c.locationId === l.id);
        conditions = { tempC: 18 + Math.round(r() * 7), rock: 'Dry', weather: pick(['Sunny', 'Sun then shade', 'Hot in the sun, fine in shade']) };
      } else {
        l = magic;
        pool = magicClimbs;
        conditions = { tempC: 12 + Math.round(r() * 8), rock: pick(['Dry', 'Humid, a bit greasy', 'Dry after morning rain']), weather: pick(['Overcast, cool', 'Sunny', 'Showers in the afternoon']) };
      }
      const s = mkSession(date, l, [tr.kind === 'spain' ? 'sport' : 'boulder'], {
        conditions,
        notes: pick(['Great day out, skin held up well.', 'Tired from yesterday but found some good flow.', 'Psyched! Felt strong on the steep stuff.', 'Slabs felt scary — need to trust my feet more.', 'Short day, rain came in.']),
      });
      const todays = [...pool].sort(() => r() - 0.5).slice(0, 3 + Math.floor(r() * 3));
      todays.forEach((c, k) => tryClimb(s, c, k));
    }
  }

  // ── Gym: twice a week, new set every visit ────────────
  const fontGrades = gradeList('font');
  const frenchGrades = gradeList('french');
  const colours = ['Yellow', 'Green', 'Blue', 'Purple', 'Red', 'Black', 'White', 'Orange'];
  const wallStyles: StyleTag[][] = [['overhang', 'powerful'], ['slab', 'technical'], ['crimpy', 'vertical'], ['slopers', 'overhang'], ['roof', 'powerful'], ['vertical', 'technical'], ['crimpy', 'overhang'], ['slab']];
  const gymProjects: Climb[] = [];
  for (let day = -364; day <= -1; day++) {
    const date = addDays(today, day);
    const dow = new Date(`${date}T12:00:00`).getDay();
    if (inTrip(date)) continue;
    const isBoulderNight = dow === 2 || (dow === 6 && r() < 0.5);
    const isLeadNight = dow === 4 && r() < 0.8;
    if (!isBoulderNight && !isLeadNight) continue;
    if (r() < 0.12) continue; // skipped
    if (isBoulderNight) {
      const s = mkSession(date, gym, ['boulder'], {
        notes: r() < 0.5 ? pick(['Good session on the new set.', 'Felt weak, short session.', 'Worked the comp wall.', 'Skin thin — took it easy.']) : undefined,
      });
      const lvl = boulderLevel(date);
      let k = 0;
      // keep working last week's projects
      for (const p of gymProjects.splice(0)) if (!sent.has(p.id) && r() < 0.7) tryClimb(s, p, k++);
      const n = 5 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const gi = Math.max(3, Math.min(fontGrades.length - 1, Math.round(lvl - 3 + r() * 4.5)));
        const c = mkClimb({ name: `${pick(colours)} ${1 + Math.floor(r() * 40)}`, grade: fontGrades[gi], styles: pick(wallStyles), sector: pick(['Cave', 'Slab wall', 'Comp wall', 'Prow', 'Barrel']) }, gym, 'boulder', 'font');
        tryClimb(s, c, k++);
        if (!sent.has(c.id) && r() < 0.5) gymProjects.push(c);
      }
    } else {
      const s = mkSession(date, gym, ['sport', 'toprope']);
      const lvl = routeLevel(date);
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const gi = Math.max(5, Math.min(frenchGrades.length - 1, Math.round(lvl - 3 + r() * 4)));
        const discipline: Discipline = r() < 0.25 ? 'toprope' : 'sport';
        const c = mkClimb({ name: `Lane ${1 + Math.floor(r() * 12)} ${pick(colours).toLowerCase()}`, grade: frenchGrades[gi], styles: pick([['vertical', 'endurance'], ['overhang', 'endurance'], ['slab', 'technical'], ['crimpy', 'vertical']] as StyleTag[][]), lengthM: 14 }, gym, discipline, 'french');
        tryClimb(s, c, i);
      }
    }
  }

  // ── Training: Mon + Fri ───────────────────────────────
  for (let day = -364; day <= -1; day++) {
    const date = addDays(today, day);
    const dow = new Date(`${date}T12:00:00`).getDay();
    if (inTrip(date) || (dow !== 1 && dow !== 5) || r() < 0.15) continue;
    const p = progress(date);
    if (dow === 1) {
      training.push({
        id: id('train'), date, type: 'fingerboard', rpe: 7 + Math.floor(r() * 3), durationMin: 45,
        exercises: [
          { exerciseId: 'ex-hang-20', sets: 5, hangSec: 10, addedKg: Math.round((4 + 10 * p + r() * 2) * 2) / 2, restSec: 180 },
          { exerciseId: 'ex-repeaters', sets: 3, reps: 6, hangSec: 7, addedKg: 0, restSec: 180 },
          { exerciseId: 'ex-leg-raise', sets: 3, reps: 8 + Math.round(6 * p) },
        ],
        createdAt: t(date), demo: true,
      });
    } else {
      training.push({
        id: id('train'), date, type: 'strength', rpe: 6 + Math.floor(r() * 3), durationMin: 60,
        exercises: [
          { exerciseId: 'ex-pullup', sets: 4, reps: Math.round(6 + 5 * p + r()), addedKg: Math.round(5 * p), restSec: 150 },
          { exerciseId: 'ex-pushup', sets: 3, reps: Math.round(15 + 10 * p), restSec: 90 },
          { exerciseId: 'ex-dip', sets: 3, reps: Math.round(8 + 4 * p), restSec: 90 },
          { exerciseId: 'ex-lockoff', sets: 3, reps: 3, hangSec: Math.round(5 + 5 * p), addedKg: 0 },
        ],
        notes: r() < 0.3 ? pick(['Felt strong today', 'Shoulder a bit tight', 'New PB on pull-ups']) : undefined,
        createdAt: t(date), demo: true,
      });
    }
  }

  // ── Demo photos ───────────────────────────────────────
  const photo = (ownerType: Media['ownerType'], ownerId: string, title: string, hue: string) => {
    const blob = new Blob([DEMO_PHOTO_SVG(title, hue)], { type: 'image/svg+xml' });
    media.push({ id: id('media'), ownerType, ownerId, kind: 'image', mime: 'image/svg+xml', name: `${title}.svg`, size: blob.size, blob, createdAt: now, demo: true });
  };
  for (const c of climbs.filter((c) => c.stars === 3).slice(0, 6)) photo('climb', c.id, c.name, c.discipline === 'boulder' ? '#89A377' : '#E7BD8B');
  const tripSessions = sessions.filter((s) => s.type === 'outdoor');
  for (const s of tripSessions.filter((_, i) => i % 4 === 0)) photo('session', s.id, 'Session day', '#0F4E77');

  return { locations, climbs, sessions, attempts, training, media };
}

export async function seedDemo(database: SendlogDB = defaultDb) {
  const d = buildSeed();
  await database.transaction('rw', [database.locations, database.climbs, database.sessions, database.attempts, database.training, database.media], async () => {
    await database.locations.bulkPut(d.locations);
    await database.climbs.bulkPut(d.climbs);
    await database.sessions.bulkPut(d.sessions);
    await database.attempts.bulkPut(d.attempts);
    await database.training.bulkPut(d.training);
    await database.media.bulkPut(d.media);
  });
}

export async function clearDemo(database: SendlogDB = defaultDb) {
  const tables = [database.locations, database.climbs, database.sessions, database.attempts, database.training, database.media];
  await database.transaction('rw', tables, async () => {
    for (const t of tables) await (t as typeof database.climbs).filter((x) => !!x.demo).delete();
  });
}

export async function hasDemo(database: SendlogDB = defaultDb) {
  return (await database.sessions.filter((s) => !!s.demo).count()) > 0;
}
