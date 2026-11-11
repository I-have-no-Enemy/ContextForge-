import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RefreshCw } from '../components/icons';
import * as api from '../services/api';
import type { AiSkill, McpServer, Pagination } from '../services/api';
import { href } from '../lib/router';
import { browseMemory } from '../lib/browseMemory';
import { scrollPageTo } from '../lib/smoothScroll';
import { CLIENTS, useCart } from '../lib/cart';
import { Button } from '../components/ui/button';
import { Tag } from '../components/ui/badge';
import { maxRisk, type RiskLevel } from '../components/ui/risk-meter';
import { ComposerHero } from './landing/ComposerHero';
import { RiskLanes } from './landing/RiskLanes';
import { Tabs } from '../components/ui/tabs';
import { SearchField } from '../components/ui/search-field';
import { RegistryCard } from '../components/ui/registry-card';
import { ConfigRail } from '../components/ui/config-rail';
import { EmptyState } from '../components/ui/empty-state';
import { Pager } from '../components/forms';

const PAGE_SIZE = 12;
const toolLevels = (s: McpServer): RiskLevel[] => (s.tools ?? []).map((t) => t.risk_level);

export function BrowseView() {
  const cart = useCart();
  // Coming back from a detail page: the tab, search and page the user had, and the lists they were looking at.
  const [tab, setTab] = useState<'servers' | 'skills'>(browseMemory.ui?.tab ?? 'servers');
  const [search, setSearch] = useState(browseMemory.ui?.search ?? '');
  const [client, setClient] = useState(browseMemory.ui?.client ?? 'all');
  const [page, setPage] = useState(browseMemory.ui?.page ?? { servers: 1, skills: 1 });

  const [servers, setServers] = useState<McpServer[]>(browseMemory.lists?.servers ?? []);
  const [skills, setSkills] = useState<AiSkill[]>(browseMemory.lists?.skills ?? []);
  const [meta, setMeta] = useState<{ servers?: Pagination; skills?: Pagination }>(browseMemory.lists?.meta ?? {});
  const [loading, setLoading] = useState(!browseMemory.lists);
  // The first refresh after a return updates quietly: swapping the cards for a skeleton would move the page.
  const seeded = useRef(Boolean(browseMemory.lists));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!seeded.current) setLoading(true);
    setError(null);
    try {
      const [s, k] = await Promise.all([
        api.listServers({ search, page: page.servers, limit: PAGE_SIZE }),
        api.listSkills({ search, client, page: page.skills, limit: PAGE_SIZE }),
      ]);
      setServers(s.data);
      setSkills(k.data);
      setMeta({ servers: s.pagination, skills: k.pagination });
      browseMemory.lists = { servers: s.data, skills: k.data, meta: { servers: s.pagination, skills: k.pagination } };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registry API unreachable.');
    } finally {
      seeded.current = false;
      setLoading(false);
    }
  }, [search, client, page]);

  // Debounced refetch on search, filter and page changes (also the first load).
  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  // A new query starts from page 1 (but not the first run, which would undo a restored page).
  const firstQuery = useRef(true);
  useEffect(() => {
    if (firstQuery.current) {
      firstQuery.current = false;
      return;
    }
    setPage({ servers: 1, skills: 1 });
  }, [search, client]);

  useEffect(() => {
    browseMemory.ui = { tab, search, client, page };
  }, [tab, search, client, page]);

  // Remember where the page is scrolled to: on every scroll, and at the moment a link is followed.
  useEffect(() => {
    const save = () => {
      // Leaving this page shrinks the document and the browser clamps the scroll position; that is not the user's place.
      if (window.location.hash.replace(/^#\/?/, '') !== '') return;
      browseMemory.y = window.scrollY;
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('a[href^="#/"]')) save();
    };
    window.addEventListener('scroll', save, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('scroll', save);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // Put the page back where it was before the user opened an item. With the lists restored the page already has
  // its old height; the loop covers a first visit with nothing cached.
  useLayoutEffect(() => {
    const y = browseMemory.y;
    if (!y) {
      scrollPageTo(0);
      return;
    }
    let frame = 0;
    let raf = 0;
    const restore = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room >= y - 2 || frame++ > 90) scrollPageTo(Math.min(y, Math.max(0, room)));
      else raf = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(raf);
  }, []);

  // "/" focuses search (UX.md keyboard-first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        document.getElementById('registry-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clear = () => {
    setSearch('');
    setClient('all');
  };

  const openRegistry = (next: 'servers' | 'skills') => {
    setTab(next);
    // Wait one frame so the tab content has rendered before scrolling to it.
    window.requestAnimationFrame(() => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const cards =
    tab === 'servers'
      ? servers.map((s) => (
          <RegistryCard
            key={s.id}
            kind="mcp"
            href={href.server(s.id)}
            name={s.name}
            description={s.description || 'No description provided.'}
            command={s.install_command}
            verified={s.is_verified ?? true}
            risk={maxRisk(toolLevels(s))}
            stats={[
              { label: 'stars', value: s.github_stars },
              { label: 'exports', value: s.downloads_count },
            ]}
            selected={cart.has(s.id)}
            onToggle={() => cart.toggle({ id: s.id, kind: 'mcp', name: s.name })}
          />
        ))
      : skills.map((k) => (
          <RegistryCard
            key={k.id}
            kind="skill"
            href={href.skill(k.id)}
            name={k.name}
            description={k.description || 'AI playbook and workflow specification.'}
            tags={k.tags?.length ? k.tags.slice(0, 4) : k.compatible_clients}
            verified={k.is_verified ?? true}
            flagged={Boolean(k.scan_flags?.prompt_injection_detected)}
            stats={[{ label: 'exports', value: k.downloads_count }]}
            selected={cart.has(k.id)}
            onToggle={() => cart.toggle({ id: k.id, kind: 'skill', name: k.name, clients: k.compatible_clients })}
          />
        ));

  return (
    <>
      <ComposerHero />
      <RiskLanes serverTotal={meta.servers?.total} skillTotal={meta.skills?.total} onOpen={openRegistry} />

      <section className="section pg" id="browse" aria-labelledby="browse-h">
        <div className="sec-h">
          <div>
            <h2 id="browse-h">Browse the registry</h2>
            <p>
              Servers show their highest-risk tool. Skills show the clients they run in. Open a card for its tools and
              source, or add it to the config cart.
            </p>
          </div>
        </div>

        <div className="browse">
          <div>
            <Tabs
              label="Catalogue"
              value={tab}
              onChange={(id) => setTab(id as 'servers' | 'skills')}
              items={[
                { id: 'servers', label: 'MCP servers', count: meta.servers?.total ?? servers.length },
                { id: 'skills', label: 'Skills', count: meta.skills?.total ?? skills.length },
              ]}
            />
            <div className="browse__tools">
              <SearchField
                id="registry-search"
                label={`Search ${tab === 'servers' ? 'servers' : 'skills'}`}
                value={search}
                onChange={setSearch}
                placeholder={tab === 'servers' ? 'postgres, search, memory' : 'security, tdd, study'}
                hint="/"
              />
              {tab === 'skills' ? (
                <div className="filters" role="group" aria-label="Filter by client">
                  {['all', ...CLIENTS.map((c) => c.id)].map((c) => (
                    <Tag key={c} pressed={client === c} onClick={() => setClient(c)}>
                      {c}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span />
              )}
            </div>

            {error ? (
              <EmptyState
                heading="Registry API unreachable"
                action={
                  <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>
                    Retry
                  </Button>
                }
              >
                {error}
              </EmptyState>
            ) : loading && cards.length === 0 ? (
              <div className="browse__grid" aria-busy="true" aria-label="Loading registry">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="skeleton skeleton--card" />
                ))}
              </div>
            ) : cards.length ? (
              <>
                <div className="browse__grid" aria-busy={loading}>
                  {cards}
                </div>
                <Pager
                  pagination={tab === 'servers' ? meta.servers : meta.skills}
                  onPage={(p) => setPage((prev) => ({ ...prev, [tab]: p }))}
                />
              </>
            ) : (
              <EmptyState
                heading="No matching extensions found"
                action={
                  <Button variant="ghost" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                }
              >
                No verified {tab === 'servers' ? 'servers' : 'skills'} matched. Try a shorter search or another client.
              </EmptyState>
            )}
          </div>

          <div className="browse__rail">
            <ConfigRail
              id="config-cart"
              items={cart.items}
              clients={CLIENTS}
              client={cart.client}
              onClientChange={(id) => cart.setClient(id as api.ClientId)}
              onRemove={cart.remove}
              onGenerate={cart.generate}
              warnings={cart.warnings}
              generating={cart.generating}
              onBrowse={() => document.getElementById('registry-search')?.focus()}
            />
          </div>
        </div>
      </section>
    </>
  );
}
