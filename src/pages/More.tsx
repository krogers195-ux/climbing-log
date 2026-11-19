import { href } from '../router';

const LINKS = [
  { to: '/sessions', title: 'Sessions', sub: 'Every climbing session, newest first' },
  { to: '/locations', title: 'Locations', sub: 'Browse by country → area → crag' },
  { to: '/climbs?status=project', title: 'Projects', sub: 'What you are working on' },
  { to: '/search', title: 'Search', sub: 'Climbs, crags, beta and notes' },
  { to: '/exercises', title: 'Exercise library', sub: 'Edit exercises and what they record' },
  { to: '/settings', title: 'Settings & backup', sub: 'Grades, theme, export, import, storage' },
];

export default function MorePage() {
  return (
    <div className="stack">
      <h1>More</h1>
      <div className="card">
        <ul className="list">
          {LINKS.map((l) => (
            <li key={l.to}>
              <a className="list-item" href={href(l.to)}>
                <span className="grow"><div className="title">{l.title}</div><div className="sub">{l.sub}</div></span>
                <span aria-hidden>→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
