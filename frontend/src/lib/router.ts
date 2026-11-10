import { useEffect, useSyncExternalStore } from 'react';

/**
 * Hash routes, so deep links work on any static host without server rewrites.
 * #/ | #/servers/:id | #/skills/:id | #/workspace[/servers|skills|configs] | #/admin
 */
export type Route =
  | { name: 'browse' }
  | { name: 'server'; id: string }
  | { name: 'skill'; id: string }
  | { name: 'workspace'; tab: 'servers' | 'skills' | 'configs' }
  | { name: 'admin' }
  | { name: 'notfound' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, arg] = parts;
  if (!head) return { name: 'browse' };
  if (head === 'servers' && arg) return { name: 'server', id: decodeURIComponent(arg) };
  if (head === 'skills' && arg) return { name: 'skill', id: decodeURIComponent(arg) };
  if (head === 'workspace') {
    const tab = arg === 'skills' || arg === 'configs' ? arg : 'servers';
    return { name: 'workspace', tab };
  }
  if (head === 'admin') return { name: 'admin' };
  return { name: 'notfound' };
}

export const href = {
  browse: () => '#/',
  server: (id: string) => `#/servers/${encodeURIComponent(id)}`,
  skill: (id: string) => `#/skills/${encodeURIComponent(id)}`,
  workspace: (tab: 'servers' | 'skills' | 'configs' = 'servers') => `#/workspace/${tab}`,
  admin: () => '#/admin',
};

export const navigate = (to: string) => {
  window.location.hash = to.replace(/^#/, '');
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  // Page-level navigation starts at the top; tab switches inside a page keep their place.
  const page = hash.split('/')[1] ?? '';
  // Braces matter: newer browsers return a Promise from scrollTo, and React would treat it as a cleanup.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);
  return parseHash(hash);
}
