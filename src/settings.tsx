import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from './db/db';
import { DEFAULT_GRADE_PREFS, type GradePrefs } from './lib/grades/grades';

export type Theme = 'system' | 'light' | 'dark';

export interface AppSettings {
  grades: GradePrefs;
  theme: Theme;
  lastBackupAt: number | null;
  ready: boolean;
  dark: boolean; // resolved
}

const Ctx = createContext<AppSettings>({
  grades: DEFAULT_GRADE_PREFS, theme: 'system', lastBackupAt: null, ready: false, dark: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  const map = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r.value])), [rows]);
  const theme = (map.get('theme') as Theme) ?? 'system';
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    mq?.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', (theme === 'dark' || (theme === 'system' && sysDark)) ? '#372516' : '#0F4E77');
  }, [theme, sysDark]);
  const value: AppSettings = {
    grades: { ...DEFAULT_GRADE_PREFS, ...((map.get('grades') as Partial<GradePrefs>) ?? {}) },
    theme,
    lastBackupAt: (map.get('lastBackupAt') as number) ?? null,
    ready: rows !== undefined,
    dark: theme === 'dark' || (theme === 'system' && sysDark),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
export const saveGradePrefs = (g: GradePrefs) => setSetting('grades', g);
export const saveTheme = (t: Theme) => setSetting('theme', t);
