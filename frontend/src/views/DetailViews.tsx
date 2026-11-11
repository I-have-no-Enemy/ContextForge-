import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ExternalLink, Pencil, Plus, Trash2 } from '../components/icons';
import * as api from '../services/api';
import type { AiSkill, McpServer } from '../services/api';
import { href, navigate } from '../lib/router';
import { canManage, useSession } from '../lib/session';
import { useCart } from '../lib/cart';
import { errorText, useToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Tag } from '../components/ui/badge';
import { RiskMeter, maxRisk } from '../components/ui/risk-meter';
import { ScanReport, parseScanFlags } from '../components/ui/scan-report';
import { EmptyState } from '../components/ui/empty-state';
import { ConfirmDialog, ReviewBadge } from '../components/forms';
import { ServerEditor, SkillEditor, ToolEditor } from '../components/editors';

/** Loads one record; 404 and hidden-unverified both land on the same not-found state. */
function useRecord<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<api.ApiError | Error | null>(null);
  const reload = useCallback(() => {
    setError(null);
    load().then(setData).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

function DetailShell({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <section className="section pg detail" aria-label={`${kind} detail`}>
      <a className="back-link" href={href.browse()}>
        <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" /> Registry
      </a>
      {children}
    </section>
  );
}

function NotFound({ kind, error }: { kind: string; error: Error }) {
  const status = error instanceof api.ApiError ? error.status : 0;
  return (
    <EmptyState
      heading={status === 404 || status === 400 ? `${kind} not found` : `Could not load this ${kind.toLowerCase()}`}
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate(href.browse())}>
          Back to registry
        </Button>
      }
    >
      {status === 404
        ? 'It was removed, or it is still waiting for review. Unverified items are visible to their owner and admins only.'
        : status === 400
          ? 'This link does not point to a valid item. Check the address or go back to the registry.'
          : error.message}
    </EmptyState>
  );
}

const Loading = () => <div className="skeleton skeleton--detail" aria-busy="true" aria-label="Loading" />;

// ------------------------------------------------------------------ Server

export function ServerDetailView({ id }: { id: string }) {
  const { user } = useSession();
  const cart = useCart();
  const toast = useToast();
  const load = useCallback(() => api.getServer(id), [id]);
  const { data: server, error, reload } = useRecord<McpServer>(load);
  const [editing, setEditing] = useState(false);
  const [addingTool, setAddingTool] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: 'server' } | { kind: 'tool'; toolId: string; name: string }>(null);

  if (error) return <DetailShell kind="Server"><NotFound kind="Server" error={error} /></DetailShell>;
  if (!server) return <DetailShell kind="Server"><Loading /></DetailShell>;

  const manage = canManage(user, server.submitted_by);
  const tools = server.tools ?? [];
  const risk = maxRisk(tools.map((t) => t.risk_level));

  return (
    <DetailShell kind="Server">
      <header className="detail__head">
        <div className="detail__title">
          <span className="eyebrow">MCP server</span>
          <h1>{server.name}</h1>
          <p className="detail__desc">{server.description || 'No description provided.'}</p>
        </div>
        <div className="detail__acts">
          <ReviewBadge verified={server.is_verified} />
          {server.is_verified && (
            <Button
              variant={cart.has(server.id) ? 'ghost' : 'primary'}
              size="sm"
              icon={cart.has(server.id) ? Check : Plus}
              aria-pressed={cart.has(server.id)}
              onClick={() => cart.toggle({ id: server.id, kind: 'mcp', name: server.name })}
            >
              {cart.has(server.id) ? 'In config' : 'Add to config'}
            </Button>
          )}
          {manage && (
            <>
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="quiet" size="sm" icon={Trash2} onClick={() => setConfirm({ kind: 'server' })}>
                Delete
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="detail__grid">
        <dl className="facts">
          <dt>Install</dt>
          <dd className="cf-mono">{server.install_command}</dd>
          <dt>Highest risk</dt>
          <dd>{tools.length ? <RiskMeter level={risk} /> : <span className="cf-muted">No tools listed</span>}</dd>
          <dt>Env vars</dt>
          <dd>
            {server.required_env_vars.length ? (
              <div className="cf-row" style={{ gap: 6 }}>
                {server.required_env_vars.map((v) => (
                  <Tag key={v}>{v}</Tag>
                ))}
              </div>
            ) : (
              <span className="cf-muted">None</span>
            )}
          </dd>
          <dt>Repository</dt>
          <dd>
            {server.repository_url ? (
              <a className="ext-link" href={server.repository_url} target="_blank" rel="noreferrer noopener">
                {server.repository_url.replace(/^https?:\/\//, '')} <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : (
              <span className="cf-muted">Not provided</span>
            )}
          </dd>
          <dt>Community</dt>
          <dd className="cf-mono">
            {server.github_stars.toLocaleString('en-US')} stars · {(server.github_contributors ?? 0).toLocaleString('en-US')} contributors
            {server.github_last_synced_at && (
              <span className="cf-muted"> · synced {formatDate(server.github_last_synced_at)}</span>
            )}
          </dd>
          <dt>Config exports</dt>
          <dd className="cf-mono">{server.downloads_count}</dd>
          {server.user && (
            <>
              <dt>Submitted by</dt>
              <dd>{server.user.email}</dd>
            </>
          )}
        </dl>

        <div className="tools">
          <div className="tools__head">
            <h2>Tools ({tools.length})</h2>
            {manage && (
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setAddingTool(true)}>
                Add tool
              </Button>
            )}
          </div>
          {tools.length === 0 ? (
            <EmptyState heading="No tools listed">
              {manage ? 'Add each tool this server exposes so users can judge its reach.' : 'The author has not listed any tools yet.'}
            </EmptyState>
          ) : (
            <ul className="tools__list">
              {tools.map((t) => (
                <li key={t.tool_id ?? t.name} className="tool">
                  <div className="tool__head">
                    <span className="cf-mono tool__name">{t.name}</span>
                    <RiskMeter level={t.risk_level} />
                    {manage && t.tool_id && (
                      <button
                        type="button"
                        className="cf-iconbtn"
                        aria-label={`Delete tool ${t.name}`}
                        onClick={() => setConfirm({ kind: 'tool', toolId: t.tool_id, name: t.name })}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  {t.description && <p className="tool__desc">{t.description}</p>}
                  {t.input_schema && Object.keys(t.input_schema).length > 0 && (
                    <details>
                      <summary>Input schema</summary>
                      <pre className="cf-code">{JSON.stringify(t.input_schema, null, 2)}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ServerEditor open={editing} server={server} onClose={() => setEditing(false)} onSaved={reload} />
      <ToolEditor open={addingTool} serverId={server.id} onClose={() => setAddingTool(false)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'tool' ? `Delete tool ${confirm.name}?` : `Delete ${server.name}?`}
        body={
          confirm?.kind === 'tool'
            ? 'The tool definition is removed from this server.'
            : 'The server leaves the registry (soft delete). Configs generated earlier keep their snapshot.'
        }
        confirmLabel="Delete"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            if (confirm?.kind === 'tool') {
              await api.deleteTool(server.id, confirm.toolId);
              toast(`Tool ${confirm.name} deleted.`);
              reload();
            } else {
              await api.deleteServer(server.id);
              cart.remove(server.id);
              toast(`${server.name} deleted.`);
              navigate(href.workspace('servers'));
            }
          } catch (err) {
            toast(errorText(err), 'error');
          }
        }}
      />
    </DetailShell>
  );
}

// ------------------------------------------------------------------ Skill

export function SkillDetailView({ id }: { id: string }) {
  const { user } = useSession();
  const cart = useCart();
  const toast = useToast();
  const load = useCallback(() => api.getSkill(id), [id]);
  const { data: skill, error, reload } = useRecord<AiSkill>(load);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error) return <DetailShell kind="Skill"><NotFound kind="Skill" error={error} /></DetailShell>;
  if (!skill) return <DetailShell kind="Skill"><Loading /></DetailShell>;

  const manage = canManage(user, skill.submitted_by);
  const scan = skill.scan_flags;
  const flagged = Boolean(scan?.prompt_injection_detected);

  return (
    <DetailShell kind="Skill">
      <header className="detail__head">
        <div className="detail__title">
          <span className="eyebrow">Skill · SKILL.md</span>
          <h1>{skill.name}</h1>
          <p className="detail__desc">{skill.description || 'AI playbook and workflow specification.'}</p>
        </div>
        <div className="detail__acts">
          <ReviewBadge verified={skill.is_verified} review={flagged ? { status: 'pending', flagged_by_scan: true, review_notes: null, reviewed_at: '' } : null} />
          {skill.is_verified && !flagged && (
            <Button
              variant={cart.has(skill.id) ? 'ghost' : 'primary'}
              size="sm"
              icon={cart.has(skill.id) ? Check : Plus}
              aria-pressed={cart.has(skill.id)}
              onClick={() => cart.toggle({ id: skill.id, kind: 'skill', name: skill.name, clients: skill.compatible_clients })}
            >
              {cart.has(skill.id) ? 'In config' : 'Add to config'}
            </Button>
          )}
          {manage && (
            <>
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="quiet" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="detail__grid">
        <dl className="facts">
          <dt>Clients</dt>
          <dd>
            <div className="cf-row" style={{ gap: 6 }}>
              {skill.compatible_clients.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </div>
          </dd>
          <dt>Tags</dt>
          <dd>{skill.tags.length ? skill.tags.join(', ') : <span className="cf-muted">None</span>}</dd>
          <dt>Scanner</dt>
          <dd className="cf-mono">
            {flagged ? `${scan?.flags?.length ?? 0} finding(s), risk ${scan?.riskScore ?? 0}/100` : 'No findings'}
          </dd>
          <dt>Config exports</dt>
          <dd className="cf-mono">{skill.downloads_count}</dd>
          {skill.user && (
            <>
              <dt>Submitted by</dt>
              <dd>{skill.user.email}</dd>
            </>
          )}
        </dl>

        <div className="stack-24">
          {flagged && (
            <ScanReport name={skill.name} score={scan?.riskScore ?? 0} flags={parseScanFlags(scan?.flags)} excerpt={skill.skill_content} />
          )}
          {/* Rendered as plain text: skill content is untrusted (OWASP LLM02). */}
          <pre className="cf-code skill-source" aria-label="SKILL.md source">
            {skill.skill_content}
          </pre>
        </div>
      </div>

      <SkillEditor open={editing} skill={skill} onClose={() => setEditing(false)} onSaved={reload} />
      <ConfirmDialog
        open={deleting}
        title={`Delete ${skill.name}?`}
        body="The skill leaves the registry (soft delete). Configs generated earlier keep their snapshot."
        confirmLabel="Delete"
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await api.deleteSkill(skill.id);
            cart.remove(skill.id);
            toast(`${skill.name} deleted.`);
            navigate(href.workspace('skills'));
          } catch (err) {
            toast(errorText(err), 'error');
          }
        }}
      />
    </DetailShell>
  );
}
