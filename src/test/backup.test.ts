import { describe, expect, it } from 'vitest';
import { SendlogDB } from '../db/db';
import { buildSeed } from '../db/seed';
import { packZip, readDatabase, unpackZip, writeDatabase } from '../lib/backup';
import { climbingCSV } from '../lib/csv';

async function fill(db: SendlogDB) {
  const d = buildSeed('2026-11-19');
  await db.locations.bulkPut(d.locations);
  await db.climbs.bulkPut(d.climbs);
  await db.sessions.bulkPut(d.sessions);
  await db.attempts.bulkPut(d.attempts);
  await db.training.bulkPut(d.training);
  await db.settings.put({ key: 'grades', value: { boulder: 'v', sport: 'yds', trad: 'uk' } });
  // media as raw bytes (incl. a fake "video")
  const bytes = new Uint8Array(4096).map((_, i) => i % 251);
  await db.media.bulkPut([
    { id: 'm1', ownerType: 'climb', ownerId: d.climbs[0].id, kind: 'image', mime: 'image/webp', size: 3, blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }), createdAt: 1 },
    { id: 'm2', ownerType: 'session', ownerId: d.sessions[0].id, kind: 'video', mime: 'video/mp4', size: bytes.length, blob: new Blob([bytes], { type: 'video/mp4' }), createdAt: 2 },
  ]);
  return d;
}

describe('backup round-trip', () => {
  it('exports and restores all data and media byte-for-byte', async () => {
    const src = new SendlogDB('src-' + Math.random());
    await fill(src);
    const before = await readDatabase(src);
    const zip = packZip(before.snapshot, before.files);
    expect(zip.byteLength).toBeGreaterThan(1000);

    const dst = new SendlogDB('dst-' + Math.random());
    await dst.climbs.add({ id: 'stale', name: 'Should be replaced', discipline: 'boulder', grade: '6A', gradeSystem: 'font', styles: [], status: 'sent', createdAt: 0 });
    const parsed = unpackZip(zip);
    await writeDatabase(dst, parsed.snapshot, parsed.files);
    const after = await readDatabase(dst);

    for (const t of Object.keys(before.snapshot.tables) as (keyof typeof before.snapshot.tables)[]) {
      const sort = (xs: any[]) => [...xs].sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)));
      expect(sort(after.snapshot.tables[t])).toEqual(sort(before.snapshot.tables[t]));
    }
    expect(await dst.climbs.get('stale')).toBeUndefined();
    expect(after.files.map((f) => f.meta.id).sort()).toEqual(['m1', 'm2']);
    const v = after.files.find((f) => f.meta.id === 'm2')!;
    expect(Array.from(v.data)).toEqual(Array.from(before.files.find((f) => f.meta.id === 'm2')!.data));
    expect(v.meta.mime).toBe('video/mp4');
    const restored = await dst.media.get('m2');
    expect(restored?.blob.type).toBe('video/mp4');
  });

  it('rejects non-Sendlog zips', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    expect(() => unpackZip(zipSync({ 'other.json': strToU8('{}') }))).toThrow(/Not a Sendlog backup/);
  });

  it('exports CSV with escaping', async () => {
    const db = new SendlogDB('csv-' + Math.random());
    const d = await fill(db);
    await db.attempts.update(d.attempts[0].id, { notes: 'Tricky, "sharp" crimp' });
    const csv = climbingCSV({
      sessions: await db.sessions.toArray(), climbs: await db.climbs.toArray(), attempts: await db.attempts.toArray(),
      locations: await db.locations.toArray(), training: [], exercises: [],
    });
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toMatch(/^date,climb,discipline,grade/);
    expect(lines.length).toBe(d.attempts.length + 1);
    expect(csv).toContain('"Tricky, ""sharp"" crimp"');
  });
});

describe('demo seed', () => {
  it('is deterministic and realistic', () => {
    const a = buildSeed('2026-11-19');
    const b = buildSeed('2026-11-19');
    expect(a.attempts.length).toBe(b.attempts.length);
    expect(a.sessions.length).toBeGreaterThan(80);
    expect(new Set(a.locations.map((l) => l.country))).toEqual(new Set(['United Kingdom', 'France', 'Switzerland', 'Spain']));
    expect(a.climbs.every((c) => c.demo)).toBe(true);
  });
});
