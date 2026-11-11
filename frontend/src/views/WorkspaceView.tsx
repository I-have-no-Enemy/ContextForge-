import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, Plus, RefreshCw } from '../components/icons';
import * as api from '../services/api';
import type { AiSkill, GeneratedConfig, McpServer, Pagination } from '../services/api';
import { href, navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { clientLabel, downloadConfig, useCart } from '../lib/cart';
import { Button } from '../components/ui/button';
import { Tag } from '../components/ui/badge';
import { Tabs } from '../components/ui/tabs';
import { RiskMeter, maxRisk } from '../components/ui/risk-meter';
import { EmptyState } from '../components/ui/empty-state';
import { Pager, ReviewBadge } from '../components/forms';
import { ServerEditor, SkillEditor } from '../components/editors';

type Tab = 'servers' | 'skills' | 'configs';

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

function usePaged<T>(load: (page: number) => Promise<{ data: T[]; pagination?: Pagination }>, active: boolean) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[] | null>(null);
  const [pagination, setPagination] = useState<Pagination>();
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    load(page)
      .then((r) => {
        setRows(r.data);
        setPagination(r.pagination);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'));
  }, [load, page]);
  useEffect(() => {
    if (active) reload();
  }, [active, reload]);
  return { rows, pagination, error, reload, setPage };
}

export function WorkspaceView({ tab }: { tab: Tab }) {
  const { user, ready, requestSignIn } = useSession();
  const cart = useCart();
  const [creating, setCreating] = useState<null | 'server' | 'skill'>(null);

  const signedIn = Boolean(user);
  const servers = usePaged<McpServer>(api.myServers, signedIn && tab === 'servers');
  const skills = usePaged<AiSkill>(api.mySkills, signedIn && tab === 'skills');
  const configs = usePaged<GeneratedConfig>(api.myConfigs, signedIn && tab === 'configs');

  if (!ready) return <section className="section pg"><div className="skeleton skeleton--detail" aria-busy="true" /></section>;

  if (!user) {
    return (
      <section className="section pg">
        <EmptyState
          heading="Sign in to see your workspace"
          action={
            <Button variant="primary" size="sm" onClick={requestSignIn}>
              Sign in or register
            </Button>
          }
        >
          Your workspace lists the servers and skills you submitted, their review status, and the configs you generated.
        </EmptyState>
      </section>
    );
  }

  const current = tab === 'servers' ? servers : tab === 'skills' ? skills : configs;

  return (
    <section className="section pg" aria-labelledby="ws-h">
      <div className="sec-h">
        <div>
          <h1 id="ws-h">Your workspace</h1>
          <p>Everything you submitted, in every review state. Editing an approved item sends it back to the queue.</p>
        </div>
        <div className="cf-row">
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => setCreating('skill')}>
            New skill
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreating('server')}>
            New server
          </Button>
        </div>
      </div>

      <Tabs
        label="Workspace"
        value={tab}
        onChange={(id) => navigate(href.workspace(id as Tab))}
        items={[
          { id: 'servers', label: 'My servers', count: servers.pagination?.total },
          { id: 'skills', label: 'My skills', count: skills.pagination?.total },
          { id: 'configs', label: 'My configs', count: configs.pagination?.total },
        ]}
      />

      <div className="ws-body">
        {current.error ? (
          <EmptyState
            heading="Could not load this list"
            action={
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={current.reload}>
                Retry
              </Button>
            }
          >
            {current.error}
          </EmptyState>
        ) : current.rows === null ? (
          <div className="skeleton skeleton--rows" aria-busy="true" aria-label="Loading" />
        ) : current.rows.length === 0 ? (
          <EmptyState
            heading={tab === 'configs' ? 'No configs yet' : `No ${tab} submitted yet`}
            action={
              tab === 'configs' ? (
                <Button variant="ghost" size="sm" onClick={() => navigate(href.browse())}>
                  Browse the registry
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreating(tab === 'servers' ? 'server' : 'skill')}>
                  Submit your first {tab === 'servers' ? 'server' : 'skill'}
                </Button>
              )
            }
          >
            {tab === 'configs'
              ? 'Add servers or skills to the cart and generate a config while signed in. It shows up here.'
              : 'Submissions are scanned, then reviewed by an admin before they appear in the public registry.'}
          </EmptyState>
        ) : (
          <>
            <ul className="rows">
              {tab === 'servers' &&
                servers.rows!.map((s) => (
                  <li key={s.id} className="row">
                    <div className="row__main">
                      <a className="row__name" href={href.server(s.id)}>
                        {s.name}
                      </a>
                      <span className="row__meta">
                        {(s.tools ?? []).length} tools · updated {when(s.updated_at)}
                      </span>
                      {s.latest_review?.review_notes && <p className="row__note">{s.latest_review.review_notes}</p>}
                    </div>
                    {(s.tools ?? []).length > 0 && <RiskMeter level={maxRisk(s.tools!.map((t) => t.risk_level))} compact />}
                    <ReviewBadge verified={s.is_verified} review={s.latest_review} />
                  </li>
                ))}
              {tab === 'skills' &&
                skills.rows!.map((k) => (
                  <li key={k.id} className="row">
                    <div className="row__main">
                      <a className="row__name" href={href.skill(k.id)}>
                        {k.name}
                      </a>
                      <span className="row__meta">
                        {k.scan_flags?.prompt_injection_detected ? `${k.scan_flags.flags?.length ?? 0} scanner finding(s)` : 'Scanner clean'} · updated{' '}
                        {when(k.updated_at)}
                      </span>
                      {k.latest_review?.review_notes && <p className="row__note">{k.latest_review.review_notes}</p>}
                    </div>
                    <ReviewBadge verified={k.is_verified} review={k.latest_review} />
                  </li>
                ))}
              {tab === 'configs' &&
                configs.rows!.map((c) => (
                  <li key={c.id} className="row">
                    <div className="row__main">
                      <span className="row__name">{clientLabel(c.client_type)}</span>
                      <span className="row__meta">
                        {c.selected_server_ids.length} servers · {c.selected_skill_ids.length} skills · {when(c.created_at)}
                      </span>
                    </div>
                    <Tag>{c.id.slice(0, 8)}</Tag>
                    <Button variant="quiet" size="sm" icon={Eye} onClick={() => cart.show(c)}>
                      View
                    </Button>
                    <Button variant="ghost" size="sm" icon={Download} onClick={() => downloadConfig(c)}>
                      Download
                    </Button>
                  </li>
                ))}
            </ul>
            <Pager pagination={current.pagination} onPage={current.setPage} />
          </>
        )}
      </div>

      <ServerEditor
        open={creating === 'server'}
        onClose={() => setCreating(null)}
        onSaved={(s) => {
          navigate(href.server(s.server_id ?? s.id));
        }}
      />
      <SkillEditor
        open={creating === 'skill'}
        onClose={() => setCreating(null)}
        onSaved={(k) => {
          navigate(href.skill(k.skill_id ?? k.id));
        }}
      />
    </section>
  );
}
