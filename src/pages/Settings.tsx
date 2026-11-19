import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../db/db';
import { clearDemo, hasDemo, seedDemo } from '../db/seed';
import type { GradeSystem } from '../db/types';
import { GRADE_SYSTEM_LABEL } from '../db/types';
import { saveGradePrefs, saveTheme, useSettings, type Theme } from '../settings';
import { BOULDER_SYSTEMS, ROUTE_SYSTEMS } from '../lib/grades/grades';
import { downloadBlob, exportZip, importZip } from '../lib/backup';
import { climbingCSV, trainingCSV } from '../lib/csv';
import { formatBytes } from '../lib/media';
import { isPersisted, requestPersistence, storageEstimate } from '../lib/storage';
import { toast, useDataset } from '../hooks';
import { todayISO, prettyDate } from '../lib/dates';
import { toISODate } from '../lib/dates';
import { Chips } from '../components/ui';

export default function SettingsPage() {
  const s = useSettings();
  const ds = useDataset();
  const demo = useLiveQuery(() => hasDemo(), []);
  const mediaStats = useLiveQuery(async () => {
    let bytes = 0;
    let n = 0;
    await db.media.each((m) => { bytes += m.size; n++; });
    return { bytes, n };
  }, []);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setEst(await storageEstimate());
    setPersisted(await isPersisted());
  };
  useEffect(() => { refresh(); }, [mediaStats?.bytes]);

  const doExport = async () => {
    setBusy('Preparing backup…');
    try {
      const blob = await exportZip(db);
      downloadBlob(blob, `sendlog-backup-${todayISO()}.zip`);
      await setSetting('lastBackupAt', Date.now());
      toast(`Backup ready (${formatBytes(blob.size)})`);
    } catch (e) {
      toast(`Backup failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File) => {
    if (!window.confirm(`Restore from “${file.name}”? This REPLACES everything currently in Sendlog on this device.`)) return;
    setBusy('Restoring…');
    try {
      const r = await importZip(db, file);
      await setSetting('seeded', true);
      toast(`Restored ${r.records} records and ${r.media} media files`);
    } catch (e) {
      window.alert(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const csv = (kind: 'climbing' | 'training') => {
    if (!ds) return;
    const text = kind === 'climbing' ? climbingCSV(ds) : trainingCSV(ds);
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `sendlog-${kind}-${toISODate(new Date())}.csv`);
  };

  return (
    <div className="stack">
      <h1>Settings</h1>

      <section className="card stack">
        <h2>Grades</h2>
        <p className="muted" style={{ margin: 0 }}>Climbs keep the grade you logged; these choose how grades are shown and charted.</p>
        <fieldset><legend>Bouldering</legend>
          <Chips options={BOULDER_SYSTEMS} value={s.grades.boulder} labels={GRADE_SYSTEM_LABEL} label="Boulder grades" onChange={(v: GradeSystem) => saveGradePrefs({ ...s.grades, boulder: v })} />
        </fieldset>
        <fieldset><legend>Sport & top rope</legend>
          <Chips options={ROUTE_SYSTEMS} value={s.grades.sport} labels={GRADE_SYSTEM_LABEL} label="Sport grades" onChange={(v: GradeSystem) => saveGradePrefs({ ...s.grades, sport: v })} />
        </fieldset>
        <fieldset><legend>Trad & multi-pitch</legend>
          <Chips options={ROUTE_SYSTEMS} value={s.grades.trad} labels={GRADE_SYSTEM_LABEL} label="Trad grades" onChange={(v: GradeSystem) => saveGradePrefs({ ...s.grades, trad: v })} />
        </fieldset>
      </section>

      <section className="card stack">
        <h2>Appearance</h2>
        <Chips options={['system', 'light', 'dark'] as const} value={s.theme} labels={{ system: 'Match device', light: 'Light', dark: 'Dark' }} label="Theme" onChange={(t: Theme) => saveTheme(t)} />
      </section>

      <section className="card stack">
        <h2>Backup</h2>
        <p style={{ margin: 0 }}>
          Your log lives only on this device. Export a backup .zip (all data + photos + videos) and keep it somewhere safe, like cloud storage.
        </p>
        <p className="muted" style={{ margin: 0 }}>Last backup: {s.lastBackupAt ? prettyDate(toISODate(new Date(s.lastBackupAt))) : 'never'}</p>
        <div className="row">
          <button className="btn" disabled={!!busy} onClick={doExport}>Export backup (.zip)</button>
          <label className="btn secondary" htmlFor="import-file" aria-disabled={!!busy}>Import backup…</label>
          <input id="import-file" className="sr-only" type="file" accept=".zip,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        </div>
        <div className="row">
          <button className="btn secondary" onClick={() => csv('climbing')}>Climbing log (.csv)</button>
          <button className="btn secondary" onClick={() => csv('training')}>Training log (.csv)</button>
        </div>
        {busy && <p role="status" style={{ margin: 0 }}>{busy}</p>}
      </section>

      <section className="card stack">
        <h2>Storage</h2>
        <div className="stat-row">
          <div className="stat"><div className="label">Used</div><div className="value">{est ? formatBytes(est.usage) : '–'}</div><div className="meta">{est?.quota ? `of ~${formatBytes(est.quota)} available` : ''}</div></div>
          <div className="stat"><div className="label">Media</div><div className="value">{mediaStats ? formatBytes(mediaStats.bytes) : '–'}</div><div className="meta">{mediaStats?.n ?? 0} files</div></div>
          <div className="stat"><div className="label">Protected</div><div className="value">{persisted == null ? '–' : persisted ? 'Yes' : 'No'}</div><div className="meta">{persisted ? 'Browser won’t auto-delete' : 'May be cleared if space is low'}</div></div>
        </div>
        {persisted === false && (
          <>
            <button className="btn secondary" onClick={async () => { const ok = await requestPersistence(); await refresh(); toast(ok ? 'Storage protected' : 'Browser declined — install the app to your home screen, then try again'); }}>
              Protect my data from eviction
            </button>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>Tip: browsers are more willing to protect storage once Sendlog is installed to your home screen. Safari can clear site data after weeks of not opening it unless installed — back up regularly.</p>
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Demo data</h2>
        {demo ? (
          <>
            <p style={{ margin: 0 }}>Demo sessions, climbs and training are loaded. Clearing removes only demo records — anything you logged stays.</p>
            <button className="btn danger" onClick={async () => { if (window.confirm('Remove all demo data?')) { await clearDemo(); toast('Demo data cleared'); } }}>Clear demo data</button>
          </>
        ) : (
          <button className="btn secondary" onClick={async () => { await seedDemo(); toast('Demo data loaded'); }}>Load demo data</button>
        )}
      </section>

      <section className="card stack">
        <h2>Delete everything</h2>
        <p style={{ margin: 0 }}>Permanently erase all Sendlog data on this device. Export a backup first if you want to keep it.</p>
        <button className="btn danger" onClick={async () => {
          if (!window.confirm('Erase ALL data, photos and videos on this device? This cannot be undone.')) return;
          if (window.prompt('Type DELETE to confirm') !== 'DELETE') return;
          await Promise.all([db.locations, db.sessions, db.climbs, db.attempts, db.training, db.templates, db.media].map((t) => t.clear()));
          toast('All data erased');
        }}>Erase all data</button>
      </section>

      <p className="muted" style={{ fontSize: '0.85rem' }}>Sendlog works fully offline. Nothing is sent anywhere — no account, no server.</p>
    </div>
  );
}
