import { useMemo, useState } from 'react';
import { useDataset, useGrade } from '../hooks';
import { prettyDate } from '../lib/dates';
import { href } from '../router';

interface Hit { key: string; to: string; title: string; sub: string; kind: string }

const snippet = (text: string, q: string) => {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 90);
  const s = Math.max(0, i - 30);
  return `${s ? '…' : ''}${text.slice(s, i + q.length + 50)}${i + q.length + 50 < text.length ? '…' : ''}`;
};

export default function SearchPage() {
  const ds = useDataset();
  const fmt = useGrade();
  const [q, setQ] = useState('');
  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    if (!ds || n.length < 2) return [];
    const out: Hit[] = [];
    const has = (...xs: (string | undefined)[]) => xs.find((x) => x?.toLowerCase().includes(n));
    const locs = new Map(ds.locations.map((l) => [l.id, l]));
    for (const l of ds.locations) {
      if (has(l.name, l.area, l.country)) out.push({ key: `l${l.id}`, to: `/location/${l.id}`, title: l.name, sub: [l.area, l.country].filter(Boolean).join(', '), kind: 'Location' });
    }
    for (const c of ds.climbs) {
      const m = has(c.name, c.sector, c.beta, c.likeNotes, ...c.styles);
      if (m) out.push({ key: `c${c.id}`, to: `/climb/${c.id}`, title: `${c.name} · ${fmt(c)}`, sub: m === c.name ? locs.get(c.locationId ?? '')?.name ?? '' : snippet(m, n), kind: 'Climb' });
    }
    for (const s of ds.sessions) {
      const m = has(s.notes, s.conditions?.notes, s.conditions?.weather, s.conditions?.rock);
      if (m) out.push({ key: `s${s.id}`, to: `/session/${s.id}`, title: `${locs.get(s.locationId ?? '')?.name ?? 'Session'} · ${prettyDate(s.date)}`, sub: snippet(m, n), kind: 'Session' });
    }
    const climbs = new Map(ds.climbs.map((c) => [c.id, c]));
    for (const a of ds.attempts) {
      const m = has(a.notes, a.highPoint);
      if (m) out.push({ key: `a${a.id}`, to: `/session/${a.sessionId}`, title: `${climbs.get(a.climbId)?.name ?? 'Attempt'} · ${prettyDate(a.date)}`, sub: snippet(m, n), kind: 'Attempt note' });
    }
    for (const t of ds.training) {
      if (t.notes?.toLowerCase().includes(n)) out.push({ key: `t${t.id}`, to: `/train/${t.id}`, title: `Training · ${prettyDate(t.date)}`, sub: snippet(t.notes, n), kind: 'Training' });
    }
    return out.slice(0, 100);
  }, [ds, q]);
  return (
    <div className="stack">
      <h1>Search</h1>
      <input type="search" autoFocus aria-label="Search" placeholder="Climbs, crags, beta, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 && (
        <div className="card">
          {hits.length === 0 ? <p className="muted" style={{ margin: 0 }}>No matches.</p> : (
            <ul className="list">
              {hits.map((h) => (
                <li key={h.key}>
                  <a className="list-item" href={href(h.to)}>
                    <span className="grow"><div className="title">{h.title}</div><div className="sub">{h.sub}</div></span>
                    <span className="badge outline">{h.kind}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
