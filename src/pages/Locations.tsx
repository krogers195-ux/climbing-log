import { useState } from 'react';
import { db } from '../db/db';
import type { IndoorOutdoor, Location } from '../db/types';
import { DISCIPLINE_LABEL } from '../db/types';
import { useDataset, useGrade, toast } from '../hooks';
import { locationStats, type LocationStats } from '../lib/stats';
import { prettyDate } from '../lib/dates';
import { Chips, Empty, num } from '../components/ui';
import { go, href } from '../router';
import { indexLabel } from '../lib/grades/grades';
import { useSettings } from '../settings';

/**
 * A tiny offline "map": plots crags with coordinates on an equirectangular
 * projection fitted to their bounding box. No tiles, so it always works offline.
 */
function DotMap({ stats }: { stats: LocationStats[] }) {
  const pts = stats.filter((s) => s.location.lat != null && s.location.lng != null);
  if (pts.length < 1) return null;
  const lats = pts.map((p) => p.location.lat!);
  const lngs = pts.map((p) => p.location.lng!);
  const pad = 2;
  const [minLat, maxLat] = [Math.min(...lats) - pad, Math.max(...lats) + pad];
  const [minLng, maxLng] = [Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  const W = 600;
  const H = Math.max(200, Math.min(420, (W * (maxLat - minLat)) / (maxLng - minLng || 1)));
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng || 1)) * W;
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat || 1)) * H;
  const max = Math.max(...pts.map((p) => p.sessions), 1);
  return (
    <figure className="card" style={{ margin: 0 }}>
      <h2>Where you climb</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of your crags and gyms" style={{ width: '100%', height: 'auto', background: 'var(--surface)', borderRadius: 12 }}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--line)" />)}
        {[0.25, 0.5, 0.75].map((f) => <line key={`v${f}`} y1={0} y2={H} x1={W * f} x2={W * f} stroke="var(--line)" />)}
        {pts.map((p) => (
          <a key={p.location.id} href={href(`/location/${p.location.id}`)}>
            <circle cx={x(p.location.lng!)} cy={y(p.location.lat!)} r={7 + 10 * (p.sessions / max)} fill={p.location.type === 'indoor' ? '#E7BD8B' : '#89A377'} stroke="#372516" strokeWidth={1.5} />
            <text x={x(p.location.lng!) + 14} y={y(p.location.lat!) + 5} fontSize={15} fill="var(--text)">{p.location.name}</text>
          </a>
        ))}
      </svg>
      <figcaption className="legend">
        <span style={{ ['--c' as string]: '#89A377' }}>Outdoor</span>
        <span style={{ ['--c' as string]: '#E7BD8B' }}>Indoor</span>
        <span className="muted">Dot size = sessions. Add coordinates to a crag to place it.</span>
      </figcaption>
    </figure>
  );
}

export function LocationsPage() {
  const ds = useDataset();
  const { grades } = useSettings();
  if (!ds) return null;
  const stats = locationStats(ds);
  if (!stats.length) return <Empty title="No locations yet"><p>Locations are added when you start a session.</p></Empty>;
  const tree = new Map<string, Map<string, LocationStats[]>>();
  for (const s of stats) {
    const c = s.location.country || 'Unknown country';
    const a = s.location.area || 'Unknown area';
    if (!tree.has(c)) tree.set(c, new Map());
    const areas = tree.get(c)!;
    areas.set(a, [...(areas.get(a) ?? []), s]);
  }
  const countries = [...tree.entries()].sort(([a], [b]) => a.localeCompare(b));
  const sum = (xs: LocationStats[], k: 'sessions' | 'sends') => xs.reduce((p, x) => p + x[k], 0);
  return (
    <div className="stack">
      <h1>Locations</h1>
      <div className="card">
        {countries.map(([country, areas]) => {
          const all = [...areas.values()].flat();
          return (
            <details key={country} className="tree" open>
              <summary>{country} <span className="muted">· {sum(all, 'sessions')} sessions · {sum(all, 'sends')} sends</span></summary>
              {[...areas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([area, list]) => (
                <details key={area} className="tree" open>
                  <summary>{area} <span className="muted">· {sum(list, 'sessions')} sessions</span></summary>
                  <ul className="list" style={{ marginLeft: 16 }}>
                    {list.map((s) => (
                      <li key={s.location.id}>
                        <a className="list-item" href={href(`/location/${s.location.id}`)}>
                          <span className="grow">
                            <div className="title">{s.location.name}</div>
                            <div className="sub">
                              {s.location.type} · {s.sessions} sessions · {s.sends} sends
                              {s.hardestBoulder && ` · best boulder ${indexLabel(s.hardestBoulder.index, 'boulder', grades)}`}
                              {s.hardestRoute && ` · best route ${indexLabel(s.hardestRoute.index, s.hardestRoute.climb.discipline, grades)}`}
                            </div>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </details>
          );
        })}
      </div>
      <DotMap stats={stats} />
    </div>
  );
}

function LocationEditor({ l, onDone }: { l: Location; onDone: () => void }) {
  const [f, setF] = useState(l);
  const [lat, setLat] = useState(String(l.lat ?? ''));
  const [lng, setLng] = useState(String(l.lng ?? ''));
  return (
    <div className="card stack">
      <label className="field">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="form-grid two">
        <label className="field">Area<input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></label>
        <label className="field">Country<input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></label>
        <label className="field">Rock type<input value={f.rockType ?? ''} onChange={(e) => setF({ ...f, rockType: e.target.value || undefined })} /></label>
        <div />
        <label className="field">Latitude<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 48.447" /></label>
        <label className="field">Longitude<input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 2.635" /></label>
      </div>
      <Chips options={['indoor', 'outdoor'] as const} value={f.type} labels={{ indoor: 'Indoor', outdoor: 'Outdoor' }} label="Indoor or outdoor" onChange={(type: IndoorOutdoor) => setF({ ...f, type })} />
      {'geolocation' in navigator && (
        <button className="btn secondary" type="button" onClick={() => navigator.geolocation.getCurrentPosition(
          (p) => { setLat(p.coords.latitude.toFixed(4)); setLng(p.coords.longitude.toFixed(4)); },
          () => toast('Could not get your location'),
        )}>Use my current position</button>
      )}
      <div className="row">
        <button className="btn" onClick={async () => { await db.locations.put({ ...f, lat: num(lat), lng: num(lng) }); toast('Location saved'); onDone(); }}>Save</button>
        <button className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export function LocationDetail({ id }: { id?: string }) {
  const ds = useDataset();
  const fmt = useGrade();
  const { grades } = useSettings();
  const [editing, setEditing] = useState(false);
  if (!ds) return null;
  const st = locationStats(ds).find((s) => s.location.id === id);
  if (!st) return <Empty title="Location not found" />;
  const l = st.location;
  const climbs = ds.climbs.filter((c) => c.locationId === l.id);
  const sessions = ds.sessions.filter((s) => s.locationId === l.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const sectors = [...new Set(climbs.map((c) => c.sector).filter(Boolean))] as string[];
  return (
    <div className="stack">
      <a href={href('/locations')}>← Locations</a>
      <h1 style={{ marginBottom: 0 }}>{l.name}</h1>
      <span className="muted">{[l.area, l.country, l.type, l.rockType].filter(Boolean).join(' · ')}</span>
      {editing ? <LocationEditor l={l} onDone={() => setEditing(false)} /> : (
        <div className="card stack">
          <div className="stat-row">
            <div className="stat"><div className="label">Sessions</div><div className="value">{st.sessions}</div><div className="meta">{st.lastVisit ? `Last: ${prettyDate(st.lastVisit)}` : ''}</div></div>
            <div className="stat"><div className="label">Climbs</div><div className="value">{st.climbs}</div></div>
            <div className="stat"><div className="label">Sends</div><div className="value">{st.sends}</div></div>
            {st.hardestBoulder && <div className="stat"><div className="label">Best boulder</div><div className="value">{indexLabel(st.hardestBoulder.index, 'boulder', grades)}</div><div className="meta">{st.hardestBoulder.climb.name}</div></div>}
            {st.hardestRoute && <div className="stat"><div className="label">Best route</div><div className="value">{indexLabel(st.hardestRoute.index, st.hardestRoute.climb.discipline, grades)}</div><div className="meta">{st.hardestRoute.climb.name}</div></div>}
          </div>
          <div className="row">
            <button className="btn secondary" onClick={() => setEditing(true)}>Edit location</button>
            <button className="btn ghost" onClick={() => go(`/?loc=${l.id}`)}>Dashboard for this crag</button>
          </div>
        </div>
      )}
      {sectors.length > 0 && <p className="muted">Sectors: {sectors.join(', ')}</p>}
      <div className="card">
        <h2>Climbs</h2>
        <ul className="list">
          {climbs.slice(0, 100).map((c) => (
            <li key={c.id}>
              <a className="list-item" href={href(`/climb/${c.id}`)}>
                <span className="grade">{fmt(c)}</span>
                <span className="grow"><div className="title">{c.name}</div><div className="sub">{[c.sector, DISCIPLINE_LABEL[c.discipline]].filter(Boolean).join(' · ')}</div></span>
                <span className={`badge ${c.status === 'sent' ? 'send' : 'project'}`}>{c.status === 'sent' ? 'Sent' : 'Project'}</span>
              </a>
            </li>
          ))}
        </ul>
        {climbs.length > 100 && <a href={href('/climbs')}>See all climbs</a>}
      </div>
      <div className="card">
        <h2>Sessions</h2>
        <ul className="list">
          {sessions.slice(0, 30).map((s) => (
            <li key={s.id}><a className="list-item" href={href(`/session/${s.id}`)}><span className="grow"><div className="title">{prettyDate(s.date)}</div><div className="sub">{s.notes ?? ''}</div></span></a></li>
          ))}
        </ul>
      </div>
      <button className="btn danger" onClick={async () => {
        if (sessions.length || climbs.length) {
          window.alert('This location still has sessions or climbs. Move or delete them first.');
          return;
        }
        if (!window.confirm('Delete this location?')) return;
        await db.locations.delete(l.id);
        go('/locations');
      }}>Delete location</button>
    </div>
  );
}
