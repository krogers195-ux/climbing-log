import Dexie, { type Table } from 'dexie';
import type {
  Attempt, Climb, Exercise, Location, Media, Session, Setting, Template, TrainingSession,
} from './types';
import { DEFAULT_EXERCISES } from './defaults';

export class SendlogDB extends Dexie {
  locations!: Table<Location, string>;
  sessions!: Table<Session, string>;
  climbs!: Table<Climb, string>;
  attempts!: Table<Attempt, string>;
  training!: Table<TrainingSession, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  media!: Table<Media, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'sendlog') {
    super(name);
    this.version(1).stores({
      locations: 'id, name, country, area, type',
      sessions: 'id, date, locationId, active',
      climbs: 'id, name, locationId, discipline, status',
      attempts: 'id, sessionId, climbId, date, result',
      training: 'id, date, type',
      exercises: 'id, name, category',
      templates: 'id, name',
      media: 'id, [ownerType+ownerId], createdAt',
      settings: 'key',
    });
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(DEFAULT_EXERCISES.map((e) => ({ ...e, createdAt: Date.now() })));
    });
  }
}

export const db = new SendlogDB();

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Table names that hold user data (used by backup + clear). */
export const DATA_TABLES = [
  'locations', 'sessions', 'climbs', 'attempts', 'training', 'exercises', 'templates', 'settings',
] as const;

export async function getSetting<T>(key: string, fallback: T, database: SendlogDB = db): Promise<T> {
  const row = await database.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown, database: SendlogDB = db) {
  await database.settings.put({ key, value });
}

/** Delete a climb and everything that hangs off it. */
export async function deleteClimb(id: string, database: SendlogDB = db) {
  await database.transaction('rw', database.climbs, database.attempts, database.media, async () => {
    await database.attempts.where('climbId').equals(id).delete();
    await database.media.where('[ownerType+ownerId]').equals(['climb', id]).delete();
    await database.climbs.delete(id);
  });
}

/** Delete a session, its attempts and its media. */
export async function deleteSession(id: string, database: SendlogDB = db) {
  await database.transaction('rw', database.sessions, database.attempts, database.media, async () => {
    await database.attempts.where('sessionId').equals(id).delete();
    await database.media.where('[ownerType+ownerId]').equals(['session', id]).delete();
    await database.sessions.delete(id);
  });
}

/**
 * Keep a climb's status in sync with its attempts: any send → 'sent',
 * otherwise 'project'.
 */
export async function refreshClimbStatus(climbId: string, database: SendlogDB = db) {
  const atts = await database.attempts.where('climbId').equals(climbId).toArray();
  const sent = atts.some((a) => ['onsight', 'flash', 'redpoint', 'repeat'].includes(a.result));
  await database.climbs.update(climbId, { status: sent ? 'sent' : 'project' });
}
