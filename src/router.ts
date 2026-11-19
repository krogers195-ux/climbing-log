import { useEffect, useState } from 'react';

/** Tiny hash router: '#/climb/abc' → ['climb', 'abc']. Hash routes work on any static host. */
export function useRoute(): { path: string[]; query: URLSearchParams } {
  const read = () => {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const [p, q = ''] = raw.split('?');
    return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
};
export const href = (path: string) => `#${path}`;
