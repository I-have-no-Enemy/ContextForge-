import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import * as api from '../services/api';
import type { AiSkill, McpServer, Pagination } from '../services/api';
import { href } from '../lib/router';
import { CLIENTS, useCart } from '../lib/cart';
import { Button } from '../components/ui/button';
import { Tag } from '../components/ui/badge';
import { RiskMeter, RISK_ORDER, maxRisk, type RiskLevel } from '../components/ui/risk-meter';
import { Tabs } from '../components/ui/tabs';
import { SearchField } from '../components/ui/search-field';
import { RegistryCard } from '../components/ui/registry-card';
import { ConfigRail } from '../components/ui/config-rail';
import { EmptyState } from '../components/ui/empty-state';
import { Pager } from '../components/forms';

const PAGE_SIZE = 12;
const toolLevels = (s: McpServer): RiskLevel[] => (s.tools ?? []).map((t) => t.risk_level);

/** Break long snake_case tool names only at underscores. */
function breakable(name: string) {
  const parts = name.split('_');
  return parts.map((p, i) => (
    <React.Fragment key={i}>
      {p}
      {i < parts.length - 1 && (
        <>
          _<wbr />
        </>
      )}
    </React.Fragment>
  ));
}

function RiskField({ servers }: { servers: McpServer[] }) {
  const total = servers.reduce((n, s) => n + (s.tools?.length ?? 0), 0);
  return (
    <figure className="risk-field" aria-label="Every listed tool grouped by risk level">
      <div className="risk-field__h">
        <span>Tool reach</span>
        <span>
          {total} tools · {servers.length} servers
        </span>
      </div>
      <div className="risk-field__cols">
        {RISK_ORDER.map((level) => {
          const cells = servers.flatMap((s) =>
            (s.tools ?? [])
              .filter((t) => t.risk_level === level)
              .map((t) => (
                <a key={`${s.id}-${t.name}`} className="risk-field__tool" href={href.server(s.id)}>
                  <b>{breakable(t.name)}</b>
                  <span>{s.name}</span>
                </a>
              ))
          );
          return (
            <div key={level} className="risk-field__col">
              <div className="risk-field__col-h">
                <RiskMeter level={level} compact />
              </div>
              {cells.length ? cells : <span className="risk-field__none">none listed</span>}
            </div>
          );
        })}
      </div>
      <figcaption className="risk-field__f">Left to right: what a tool can touch on the host.</figcaption>
    </figure>
  );
}

export function BrowseView() {
  const cart = useCart();
  const [tab, setTab] = useState<'servers' | 'skills'>('servers');
  const [search, setSearch] = useState('');
  const [client, setClient] = useState('all');
  const [page, setPage] = useState({ servers: 1, skills: 1 });

  const [servers, setServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<AiSkill[]>([]);
  const [meta, setMeta] = useState<{ servers?: Pagination; skills?: Pagination }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, k] = await Promise.all([
        api.listServers({ search, page: page.servers, limit: PAGE_SIZE }),
        api.listSkills({ search, client, page: page.skills, limit: PAGE_SIZE }),
      ]);
      setServers(s.data);
      setSkills(k.data);
      setMeta({ servers: s.pagination, skills: k.pagination });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registry API unreachable.');
    } finally {
      setLoading(false);
    }
  }, [search, client, page]);

  // Debounced refetch on search, filter and page changes (also the first load).
  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  // A new query starts from page 1.
  useEffect(() => {
    setPage({ servers: 1, skills: 1 });
  }, [search, client]);

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
              { label: 'runs', value: s.downloads_count },
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
            tags={k.compatible_clients}
            verified={k.is_verified ?? true}
            flagged={Boolean(k.scan_flags?.prompt_injection_detected)}
            stats={[{ label: 'exports', value: k.downloads_count }]}
            selected={cart.has(k.id)}
            onToggle={() => cart.toggle({ id: k.id, kind: 'skill', name: k.name, clients: k.compatible_clients })}
          />
        ));

  return (
    <>
      <div className="pg">
        <header className="hero">
          <div>
            <div className="eyebrow">MCP servers + SKILL.md packs</div>
            <h1>
              Know what a tool can touch <span>before your agent runs it.</span>
            </h1>
            <p className="hero__sub">
              Every server is rated by the most dangerous tool it exposes. Every skill is scanned for prompt injection.
              Pick what you trust and export one config for Claude Desktop, Cursor, Cline or Antigravity. No account
              needed.
            </p>
            <Button
              variant="primary"
              trailingIcon={ArrowUpRight}
              onClick={() => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Browse registry
            </Button>
          </div>
          <RiskField servers={servers} />
        </header>
      </div>

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
