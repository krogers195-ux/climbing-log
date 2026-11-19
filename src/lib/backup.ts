// Backup: everything (data + media) in one .zip, and back again.
//
// Zip layout:
//   sendlog.json        – all table rows; media rows without their blob
//   media/<id>.<ext>    – one file per photo/video
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Media } from '../db/types';
import { DATA_TABLES, type SendlogDB } from '../db/db';

export const BACKUP_VERSION = 1;

export type MediaMeta = Omit<Media, 'blob'> & { file: string };

export interface Snapshot {
  app: 'sendlog';
  version: number;
  exportedAt: number;
  tables: Record<(typeof DATA_TABLES)[number], unknown[]>;
  media: MediaMeta[];
}

export interface MediaFile { meta: MediaMeta; data: Uint8Array }

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif',
  'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};
const extFor = (mime: string) => EXT[mime] ?? mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') ?? 'bin';

async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

/** Read the whole database into a snapshot + media byte arrays. */
export async function readDatabase(db: SendlogDB): Promise<{ snapshot: Snapshot; files: MediaFile[] }> {
  const tables = {} as Snapshot['tables'];
  for (const t of DATA_TABLES) tables[t] = await db.table(t).toArray();
  const files: MediaFile[] = [];
  const media: MediaMeta[] = [];
  const rows = await db.media.toArray();
  for (const m of rows) {
    const { blob, ...rest } = m;
    const meta: MediaMeta = { ...rest, file: `media/${m.id}.${extFor(m.mime)}` };
    media.push(meta);
    files.push({ meta, data: await blobBytes(blob) });
  }
  return {
    snapshot: { app: 'sendlog', version: BACKUP_VERSION, exportedAt: Date.now(), tables, media },
    files,
  };
}

/** Pack a snapshot + media into zip bytes. Media is stored uncompressed (already compressed). */
export function packZip(snapshot: Snapshot, files: MediaFile[]): Uint8Array {
  const z: Zippable = { 'sendlog.json': strToU8(JSON.stringify(snapshot)) };
  for (const f of files) z[f.meta.file] = [f.data, { level: 0 }];
  return zipSync(z, { level: 6 });
}

/** Unpack zip bytes into a snapshot + media files. Throws on invalid backups. */
export function unpackZip(bytes: Uint8Array): { snapshot: Snapshot; files: MediaFile[] } {
  const entries = unzipSync(bytes);
  const json = entries['sendlog.json'];
  if (!json) throw new Error('Not a Sendlog backup (sendlog.json missing).');
  const snapshot = JSON.parse(strFromU8(json)) as Snapshot;
  if (snapshot.app !== 'sendlog') throw new Error('Not a Sendlog backup.');
  if (snapshot.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of Sendlog.');
  const files: MediaFile[] = [];
  for (const meta of snapshot.media ?? []) {
    const data = entries[meta.file];
    if (data) files.push({ meta, data });
  }
  return { snapshot, files };
}

/** Replace all data in the database with the snapshot contents. */
export async function writeDatabase(db: SendlogDB, snapshot: Snapshot, files: MediaFile[]) {
  const tables = [...DATA_TABLES.map((t) => db.table(t)), db.media];
  await db.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear();
    for (const t of DATA_TABLES) {
      const rows = snapshot.tables[t] ?? [];
      if (rows.length) await db.table(t).bulkPut(rows);
    }
    const mediaRows: Media[] = files.map(({ meta, data }) => {
      const { file: _file, ...rest } = meta;
      return { ...rest, blob: new Blob([data as BlobPart], { type: meta.mime }) };
    });
    if (mediaRows.length) await db.media.bulkPut(mediaRows);
  });
}

export async function exportZip(db: SendlogDB): Promise<Blob> {
  const { snapshot, files } = await readDatabase(db);
  const bytes = packZip(snapshot, files);
  return new Blob([bytes as BlobPart], { type: "application/zip" });
}

export async function importZip(db: SendlogDB, file: Blob) {
  const { snapshot, files } = unpackZip(await blobBytes(file));
  await writeDatabase(db, snapshot, files);
  return { records: Object.values(snapshot.tables).reduce((p, r) => p + r.length, 0), media: files.length };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
