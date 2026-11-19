import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting } from './db/db';
import { clearDemo, seedDemo } from './db/seed';
import { href, useRoute } from './router';
import { SettingsProvider, useSettings } from './settings';
import { toast, useOnline, useToastHost } from './hooks';
import { IconDumbbell, IconHome, IconMenu, IconMountain, IconPlus, IconSearch } from './components/Icons';
import Dashboard from './pages/Dashboard';
import LogPage from './pages/Log';
import { SessionsPage, SessionDetail } from './pages/Sessions';
import { ClimbsPage, ClimbDetail } from './pages/Climbs';
import { TrainingPage, TrainingEditor, ExerciseLibrary } from './pages/Training';
import { LocationsPage, LocationDetail } from './pages/Locations';
import SearchPage from './pages/Search';
import SettingsPage from './pages/Settings';
import MorePage from './pages/More';

const BACKUP_REMINDER_DAYS = 14;
let seedStarted = false;

function Nav({ section }: { section: string }) {
  const items = [
    { to: '/', key: 'home', label: 'Home', icon: <IconHome /> },
    { to: '/climbs', key: 'climbs', label: 'Climbs', icon: <IconMountain /> },
    { to: '/log', key: 'log', label: 'Log', icon: <IconPlus />, cls: 'log' },
    { to: '/train', key: 'train', label: 'Train', icon: <IconDumbbell /> },
    { to: '/more', key: 'more', label: 'More', icon: <IconMenu /> },
  ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <a key={i.key} href={href(i.to)} className={i.cls} aria-current={section === i.key ? 'page' : undefined}>
          <span className="nav-ic">{i.icon}</span>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

function sectionFor(p: string[]) {
  const s = p[0] ?? '';
  if (s === '') return 'home';
  if (['climbs', 'climb'].includes(s)) return 'climbs';
  if (s === 'log') return 'log';
  if (['train', 'exercises'].includes(s)) return 'train';
  return 'more';
}

function Banners() {
  const { lastBackupAt } = useSettings();
  const counts = useLiveQuery(async () => ({
    sessions: await db.sessions.count(),
    demo: await db.sessions.filter((s) => !!s.demo).count(),
    real: await db.sessions.filter((s) => !s.demo).count() + (await db.training.filter((t) => !t.demo).count()),
  }), []);
  const [snoozed, setSnoozed] = useState(false);
  if (!counts) return null;
  const days = lastBackupAt ? (Date.now() - lastBackupAt) / 86_400_000 : Infinity;
  const needBackup = !snoozed && counts.real > 0 && days >= BACKUP_REMINDER_DAYS;
  return (
    <>
      {counts.demo > 0 && (
        <div className="banner info" role="status">
          <span style={{ flex: 1 }}>You're looking at demo data so you can explore.</span>
          <button className="btn sm" onClick={async () => { await clearDemo(); toast('Demo data cleared'); }}>Clear demo data</button>
        </div>
      )}
      {needBackup && (
        <div className="banner" role="status">
          <span style={{ flex: 1 }}>
            {lastBackupAt ? `It's been ${Math.floor(days)} days since your last backup.` : "You haven't backed up yet."} Your log only lives on this device.
          </span>
          <a className="btn sm" href={href('/settings')} style={{ color: '#fff' }}>Back up now</a>
          <button className="btn ghost sm" onClick={() => setSnoozed(true)}>Later</button>
        </div>
      )}
    </>
  );
}

function Shell() {
  const { path, query } = useRoute();
  const online = useOnline();
  const toastMsg = useToastHost();
  const active = useLiveQuery(() => db.sessions.filter((s) => !!s.active).first(), []);
  const [p0, p1] = path;

  useEffect(() => {
    // First run: load demo data once so the dashboard has something to show.
    if (seedStarted) return;
    seedStarted = true;
    (async () => {
      if (await getSetting('seeded', false)) return;
      await setSetting('seeded', true);
      if ((await db.sessions.count()) === 0) await seedDemo();
    })();
  }, []);

  let page;
  switch (p0) {
    case undefined: page = <Dashboard />; break;
    case 'log': page = <LogPage />; break;
    case 'sessions': page = <SessionsPage />; break;
    case 'session': page = <SessionDetail id={p1} />; break;
    case 'climbs': page = <ClimbsPage query={query} />; break;
    case 'climb': page = <ClimbDetail id={p1} />; break;
    case 'train': page = p1 ? <TrainingEditor id={p1} /> : <TrainingPage />; break;
    case 'exercises': page = <ExerciseLibrary />; break;
    case 'locations': page = <LocationsPage />; break;
    case 'location': page = <LocationDetail id={p1} />; break;
    case 'search': page = <SearchPage />; break;
    case 'settings': page = <SettingsPage />; break;
    case 'more': page = <MorePage />; break;
    default: page = <Dashboard />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href('/')}>Sendlog</a>
        {!online && <span className="offline-pill" role="status">Offline · saved on device</span>}
        {active && p0 !== 'log' && <a className="live-pill" href={href('/log')}>● Session live</a>}
        <a className="icon-btn" href={href('/search')} aria-label="Search"><IconSearch /></a>
      </header>
      <main className="page">
        {!(p0 === 'log' && active) && <Banners />}
        {page}
      </main>
      <Nav section={sectionFor(path)} />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
