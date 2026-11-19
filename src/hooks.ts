import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import type { Dataset } from './lib/stats';
import { useSettings } from './settings';
import { displayGrade } from './lib/grades/grades';
import type { Climb } from './db/types';

/** All records except media blobs, live-updating. */
export function useDataset(): Dataset | undefined {
  return useLiveQuery(async () => {
    const [sessions, climbs, attempts, locations, training, exercises] = await Promise.all([
      db.sessions.toArray(), db.climbs.toArray(), db.attempts.toArray(),
      db.locations.toArray(), db.training.toArray(), db.exercises.toArray(),
    ]);
    return { sessions, climbs, attempts, locations, training, exercises };
  }, []);
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useGrade() {
  const { grades } = useSettings();
  return (c: Pick<Climb, 'grade' | 'gradeSystem' | 'discipline'>) => displayGrade(c, grades);
}

/** Object URL for a Blob that is revoked on unmount. */
export function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

let toastSetter: ((s: string | null) => void) | null = null;
export const toast = (msg: string) => toastSetter?.(msg);
export function useToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return msg;
}
