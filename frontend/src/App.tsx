import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Copy, Download, RefreshCw } from 'lucide-react';
import {
  fetchHealth,
  fetchServers,
  fetchSkills,
  fetchSkill,
  fetchServer,
  generateConfigSnapshot,
  loginUser,
  fetchAdminSubmissions,
  reviewSubmission,
  McpServer,
  AiSkill,
  GeneratedConfig,
  UserProfile,
  Submission,
} from './services/api';

import { Button } from './components/ui/button';
import { StatusBadge, Tag } from './components/ui/badge';
import { RiskMeter, RISK_ORDER, maxRisk, type RiskLevel } from './components/ui/risk-meter';
import { Tabs } from './components/ui/tabs';
import { SearchField } from './components/ui/search-field';
import { RegistryCard } from './components/ui/registry-card';
import { ScanReport, parseScanFlags } from './components/ui/scan-report';
import { ConfigRail, type CartItem, type ClientOption } from './components/ui/config-rail';
import { EmptyState } from './components/ui/empty-state';
import { Dialog } from './components/ui/dialog';

type ClientId = 'claude_desktop' | 'cursor' | 'cline' | 'antigravity';

const CLIENTS: ClientOption[] = [
  { id: 'claude_desktop', label: 'Claude Desktop', file: 'claude_desktop_config.json' },
  { id: 'cursor', label: 'Cursor', file: '.cursor/mcp.json' },
  { id: 'cline', label: 'Cline', file: 'cline_mcp_settings.json' },
  { id: 'antigravity', label: 'Antigravity', file: 'agy.mcp.json' },
];

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
                <div key={`${s.id}-${t.name}`} className="risk-field__tool">
                  <b>{breakable(t.name)}</b>
                  <span>{s.name}</span>
                </div>
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

interface ReviewTarget {
  submission: Submission;
  skill?: AiSkill;
  server?: McpServer;
  error?: string;
}

export default function App() {
  const [tab, setTab] = useState<'servers' | 'skills'>('servers');
  const [health, setHealth] = useState<{ status: string } | null>(null);

  const [servers, setServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<AiSkill[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('all');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [targetClient, setTargetClient] = useState<ClientId>('claude_desktop');

  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [inspectingSkill, setInspectingSkill] = useState<AiSkill | null>(null);

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(localStorage.getItem('contextforge_token'));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('contextforge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const isAdmin = Boolean(token && currentUser?.role === 'admin');

  useEffect(() => {
    fetchHealth()
      .then((res) => res.success && setHealth(res.data))
      .catch(() => setHealth(null));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [serversData, skillsData] = await Promise.all([
        fetchServers(searchQuery),
        fetchSkills(searchQuery, clientFilter),
      ]);
      setServers(serversData);
      setSkills(skillsData);
    } catch (err: any) {
      setFetchError(err.message || 'Database connection error.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, clientFilter]);

  // Debounced refetch on search and filter changes (also the initial load).
  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  const loadSubmissions = useCallback(() => {
    if (!isAdmin || !token) return;
    fetchAdminSubmissions(token)
      .then(setSubmissions)
      .catch((err) => setActionError(err.message || 'Failed to load review queue'));
  }, [isAdmin, token]);

  useEffect(loadSubmissions, [loadSubmissions]);

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

  const inCart = (id: string) => cart.some((c) => c.id === id);
  const toggle = (item: CartItem) =>
    setCart((prev) => (prev.some((c) => c.id === item.id) ? prev.filter((c) => c.id !== item.id) : [...prev, item]));

  const clientLabel = CLIENTS.find((c) => c.id === targetClient)?.label ?? targetClient;
  const warnings = cart
    .filter((i) => i.clients && !i.clients.includes(targetClient))
    .map((i) => `${i.name} is not compatible with ${clientLabel}. Remove it or choose another client.`);

  const handleDemoLogin = async (role: 'admin' | 'dev') => {
    setActionError(null);
    try {
      const email = role === 'admin' ? 'admin@contextforge.dev' : 'developer@contextforge.dev';
      const password = role === 'admin' ? 'AdminPassword123!' : 'DevPassword123!';
      const res = await loginUser(email, password);
      setToken(res.token);
      setCurrentUser(res.user);
      localStorage.setItem('contextforge_token', res.token);
      localStorage.setItem('contextforge_user', JSON.stringify(res.user));
    } catch (err: any) {
      setActionError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setSubmissions([]);
    setReviewTarget(null);
    localStorage.removeItem('contextforge_token');
    localStorage.removeItem('contextforge_user');
  };

  const handleGenerate = async () => {
    if (cart.length === 0 || warnings.length > 0) return;
    setIsGenerating(true);
    setActionError(null);
    try {
      const config = await generateConfigSnapshot(
        targetClient,
        cart.filter((c) => c.kind === 'mcp').map((c) => c.id),
        cart.filter((c) => c.kind === 'skill').map((c) => c.id),
        token || undefined
      );
      setGeneratedConfig(config);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate config');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedConfig) return;
    const blob = new Blob([JSON.stringify(generatedConfig.generated_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedConfig.client_type}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // The list endpoint omits skill_content, so load the full record on inspect.
  const handleInspect = async (skill: AiSkill) => {
    setInspectingSkill(skill);
    try {
      setInspectingSkill(await fetchSkill(skill.id, token || undefined));
    } catch (err: any) {
      setActionError(err.message || 'Failed to load SKILL.md');
    }
  };

  const openReview = async (submission: Submission) => {
    setReviewTarget({ submission });
    setReviewNotes('');
    setNotesError(null);
    try {
      if (submission.item_type === 'skill') {
        const skill = await fetchSkill(submission.item_id, token || undefined);
        setReviewTarget({ submission, skill });
      } else {
        const server = await fetchServer(submission.item_id, token || undefined);
        setReviewTarget({ submission, server });
      }
    } catch (err: any) {
      setReviewTarget({ submission, error: err.message || 'Failed to load item' });
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!token || !reviewTarget) return;
    const notes = reviewNotes.trim();
    if (status === 'rejected' && !notes) {
      setNotesError('Write the reason for rejection. The developer sees this note.');
      return;
    }
    try {
      await reviewSubmission(token, {
        item_type: reviewTarget.submission.item_type,
        item_id: reviewTarget.submission.item_id,
        status,
        review_notes: notes || `Approved by ${currentUser?.email}`,
      });
      setReviewTarget(null);
      loadSubmissions();
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Review failed');
    }
  };

  // Scanner hits first, then pending, then longest waiting (UX.md Persona D).
  const queue = useMemo(
    () =>
      [...submissions].sort(
        (a, b) =>
          Number(b.flagged_by_scan) - Number(a.flagged_by_scan) ||
          Number(b.status === 'pending') - Number(a.status === 'pending') ||
          new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime()
      ),
    [submissions]
  );
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  const clearFilters = () => {
    setSearchQuery('');
    setClientFilter('all');
  };

  const cards =
    tab === 'servers'
      ? servers.map((s) => (
          <RegistryCard
            key={s.id}
            kind="mcp"
            name={s.name}
            description={s.description || 'No description provided.'}
            command={s.install_command}
            verified={s.is_verified ?? true}
            risk={maxRisk(toolLevels(s))}
            stats={[
              { label: 'stars', value: s.github_stars },
              { label: 'runs', value: s.downloads_count },
            ]}
            selected={inCart(s.id)}
            onToggle={() => toggle({ id: s.id, kind: 'mcp', name: s.name })}
          />
        ))
      : skills.map((k) => (
          <RegistryCard
            key={k.id}
            kind="skill"
            name={k.name}
            description={k.description || 'AI playbook and workflow specification.'}
            tags={k.compatible_clients}
            verified={k.is_verified ?? true}
            flagged={Boolean(k.scan_flags?.prompt_injection_detected)}
            stats={[{ label: 'exports', value: k.downloads_count }]}
            selected={inCart(k.id)}
            onToggle={() => toggle({ id: k.id, kind: 'skill', name: k.name, clients: k.compatible_clients })}
            onInspect={() => handleInspect(k)}
          />
        ));

  const scrollToBrowse = () => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <div className="pg">
        <nav className="site-nav" aria-label="Primary">
          <a className="wordmark" href="#top">
            ContextForge <i>/ registry</i>
          </a>
          <ul className="site-nav__links">
            <li>
              <a href="#browse">Browse</a>
            </li>
            {isAdmin && (
              <li>
                <a href="#review">Review queue ({String(pendingCount).padStart(2, '0')})</a>
              </li>
            )}
            <li>
              <a href="https://github.com/I-have-no-Enemy/ContextForge-" target="_blank" rel="noreferrer">
                Source
              </a>
            </li>
          </ul>
          <StatusBadge tone={health?.status === 'healthy' ? 'live' : 'idle'}>
            {health?.status === 'healthy' ? 'API · healthy' : 'API · connecting'}
          </StatusBadge>
          {currentUser ? (
            <>
              <span className="site-nav__user">
                <b>{currentUser.email.split('@')[0]}</b> · {currentUser.role}
              </span>
              <Button variant="quiet" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="quiet" size="sm" onClick={() => handleDemoLogin('dev')}>
                Dev demo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDemoLogin('admin')}>
                Admin demo
              </Button>
            </>
          )}
        </nav>

        <header className="hero" id="top">
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
            <div className="cf-row" style={{ gap: 20 }}>
              <Button variant="primary" trailingIcon={ArrowUpRight} onClick={scrollToBrowse}>
                Browse registry
              </Button>
            </div>
          </div>
          <RiskField servers={servers} />
        </header>
      </div>

      <section className="section pg" id="browse" aria-labelledby="browse-h">
        <div className="sec-h">
          <div>
            <h2 id="browse-h">Browse the registry</h2>
            <p>
              Servers show their highest-risk tool. Skills show the clients they run in. Add either kind to the cart;
              incompatible picks are caught before you generate.
            </p>
          </div>
          <span className="sec-h__idx">01 / {isAdmin ? '02' : '01'}</span>
        </div>

        {actionError && (
          <div className="notice" role="alert">
            <span>{actionError}</span>
            <Button variant="quiet" size="sm" onClick={() => setActionError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        <div className="browse">
          <div>
            <Tabs
              label="Catalogue"
              value={tab}
              onChange={(id) => setTab(id as 'servers' | 'skills')}
              items={[
                { id: 'servers', label: 'MCP servers', count: servers.length },
                { id: 'skills', label: 'Skills', count: skills.length },
              ]}
            />
            <div className="browse__tools">
              <SearchField
                id="registry-search"
                label={`Search ${tab === 'servers' ? 'servers' : 'skills'}`}
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={tab === 'servers' ? 'postgres, search, memory' : 'security, tdd, study'}
                hint="/"
              />
              {tab === 'skills' ? (
                <div className="filters" role="group" aria-label="Filter by client">
                  {['all', ...CLIENTS.map((c) => c.id)].map((c) => (
                    <Tag key={c} pressed={clientFilter === c} onClick={() => setClientFilter(c)}>
                      {c}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span />
              )}
            </div>

            {fetchError ? (
              <EmptyState
                heading="Registry API unreachable"
                action={
                  <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadData}>
                    Retry
                  </Button>
                }
              >
                {fetchError}
              </EmptyState>
            ) : loading && cards.length === 0 ? (
              <p className="loading" aria-busy="true">
                Loading registry…
              </p>
            ) : cards.length ? (
              <div className="browse__grid" aria-busy={loading}>
                {cards}
              </div>
            ) : (
              <EmptyState
                heading="No matching extensions found"
                action={
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              >
                No verified tools or skills matched your filter criteria.
              </EmptyState>
            )}
          </div>

          <div className="browse__rail">
            <ConfigRail
              id="config-cart"
              items={cart}
              clients={CLIENTS}
              client={targetClient}
              onClientChange={(id) => setTargetClient(id as ClientId)}
              onRemove={(id) => setCart((prev) => prev.filter((c) => c.id !== id))}
              onGenerate={handleGenerate}
              warnings={warnings}
              generating={isGenerating}
              onBrowse={() => document.getElementById('registry-search')?.focus()}
            />
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="section pg" id="review" aria-labelledby="review-h">
          <div className="sec-h">
            <div>
              <h2 id="review-h">Review queue</h2>
              <p>Scanner hits jump the queue. Open an item to see its findings; rejecting requires a note.</p>
            </div>
            <span className="sec-h__idx">02 / 02</span>
          </div>

          {queue.length === 0 ? (
            <EmptyState heading="Review queue cleared" tone="ok">
              All pending submissions have been triaged. No security items pending.
            </EmptyState>
          ) : (
            <div className="review">
              <ul className="queue">
                {queue.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="queue__row"
                      aria-current={reviewTarget?.submission.id === s.id ? 'true' : undefined}
                      onClick={() => openReview(s)}
                    >
                      <Tag>{s.item_type}</Tag>
                      <span className="queue__id">{s.item_id}</span>
                      {s.flagged_by_scan && <StatusBadge tone="alert">LLM01</StatusBadge>}
                      <StatusBadge tone={s.status === 'pending' ? 'idle' : s.status === 'approved' ? 'live' : 'alert'}>
                        {s.status}
                      </StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>

              {reviewTarget ? (
                <ReviewPanel
                  target={reviewTarget}
                  notes={reviewNotes}
                  notesError={notesError}
                  onNotesChange={(v) => {
                    setReviewNotes(v);
                    setNotesError(null);
                  }}
                  onReview={handleReview}
                />
              ) : (
                <EmptyState heading="Select a submission">
                  Pick an item on the left to see its scan findings and source before deciding.
                </EmptyState>
              )}
            </div>
          )}
        </section>
      )}

      <footer className="site-foot pg">
        <span>ContextForge · 06016418 Server-Side Web Development, KMITL IT</span>
        <span>Risk levels: read_only · network · filesystem · destructive</span>
      </footer>

      {cart.length > 0 && (
        <div className="cart-bar">
          <span aria-live="polite">
            {cart.length} in config · {clientLabel}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => document.getElementById('config-cart')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Review &amp; generate
          </Button>
        </div>
      )}

      <Dialog
        open={Boolean(generatedConfig)}
        onOpenChange={(open) => !open && setGeneratedConfig(null)}
        title={
          <>
            Config generated <Tag>{generatedConfig?.client_type}</Tag>
          </>
        }
        description={`Snapshot ${generatedConfig?.id} · ${CLIENTS.find((c) => c.id === generatedConfig?.client_type)?.file ?? ''}`}
        footer={
          <>
            <span className="cf-mono cf-muted" style={{ fontSize: 13 }}>
              Paste into your client's config file
            </span>
            <div className="cf-row">
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={() => handleCopy(JSON.stringify(generatedConfig?.generated_json, null, 2))}
              >
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
              <Button variant="primary" size="sm" icon={Download} onClick={handleDownload}>
                Download
              </Button>
            </div>
          </>
        }
      >
        <pre className="cf-code">{JSON.stringify(generatedConfig?.generated_json, null, 2)}</pre>
      </Dialog>

      <Dialog
        open={Boolean(inspectingSkill)}
        onOpenChange={(open) => !open && setInspectingSkill(null)}
        title={
          <>
            {inspectingSkill?.name} <Tag>SKILL.md</Tag>
          </>
        }
        description={inspectingSkill?.description}
        footer={
          <>
            <span className="cf-mono cf-muted" style={{ fontSize: 13 }}>
              {inspectingSkill?.compatible_clients.join(' · ')}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setInspectingSkill(null)}>
              Close
            </Button>
          </>
        }
      >
        <pre className="cf-code">{inspectingSkill?.skill_content ?? 'Loading SKILL.md…'}</pre>
      </Dialog>
    </>
  );
}

interface ReviewPanelProps {
  target: ReviewTarget;
  notes: string;
  notesError: string | null;
  onNotesChange: (v: string) => void;
  onReview: (status: 'approved' | 'rejected') => void;
}

function ReviewPanel({ target, notes, notesError, onNotesChange, onReview }: ReviewPanelProps) {
  const { submission, skill, server, error } = target;
  const pending = submission.status === 'pending';
  const scan = skill?.scan_flags;

  return (
    <div className="panel" aria-live="polite">
      {skill && (
        <ScanReport
          name={skill.name}
          score={scan?.riskScore ?? 0}
          flags={parseScanFlags(scan?.flags)}
          excerpt={skill.skill_content}
        />
      )}
      <dl>
        <dt>Type</dt>
        <dd>{submission.item_type === 'skill' ? 'Skill' : 'MCP server'}</dd>
        <dt>Item</dt>
        <dd className="cf-mono">{skill?.name ?? server?.name ?? submission.item_id}</dd>
        {skill && (
          <>
            <dt>Clients</dt>
            <dd>
              <div className="cf-row" style={{ gap: 6 }}>
                {skill.compatible_clients.map((c) => (
                  <Tag key={c}>{c}</Tag>
                ))}
              </div>
            </dd>
          </>
        )}
        {server?.tools?.map((t) => (
          <React.Fragment key={t.name}>
            <dt>Tool</dt>
            <dd className="cf-row" style={{ justifyContent: 'space-between' }}>
              <span className="cf-mono">{t.name}</span>
              <RiskMeter level={t.risk_level} />
            </dd>
          </React.Fragment>
        ))}
        <dt>Status</dt>
        <dd>
          <StatusBadge tone={pending ? 'idle' : submission.status === 'approved' ? 'live' : 'alert'}>
            {submission.status}
          </StatusBadge>
        </dd>
        {submission.review_notes && (
          <>
            <dt>Notes</dt>
            <dd>{submission.review_notes}</dd>
          </>
        )}
      </dl>
      {error && <p className="panel__note panel__err">{error}</p>}
      {!skill && !server && !error && <p className="panel__note loading">Loading item…</p>}
      {pending && (
        <>
          <div className="panel__note">
            <label className="cf-field__label" htmlFor="review-notes">
              Review notes (required to reject)
            </label>
            <textarea
              id="review-notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              aria-invalid={Boolean(notesError)}
              aria-describedby={notesError ? 'review-notes-error' : undefined}
              placeholder="What must change before this can be verified"
            />
            {notesError && (
              <p id="review-notes-error" className="panel__err">
                {notesError}
              </p>
            )}
          </div>
          <div className="panel__acts">
            {submission.flagged_by_scan ? (
              <>
                <Button variant="primary" onClick={() => onReview('rejected')}>
                  Reject with note
                </Button>
                <Button variant="ghost" onClick={() => onReview('approved')}>
                  Approve &amp; verify
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => onReview('approved')}>
                  Approve &amp; verify
                </Button>
                <Button variant="ghost" onClick={() => onReview('rejected')}>
                  Reject with note
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
