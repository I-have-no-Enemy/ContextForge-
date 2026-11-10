import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Github, RefreshCw, ShieldOff } from 'lucide-react';
import * as api from '../services/api';
import type { AiSkill, McpServer, Metrics, Submission } from '../services/api';
import { href } from '../lib/router';
import { useSession } from '../lib/session';
import { clientLabel } from '../lib/cart';
import { errorText, useToast } from '../lib/toast';
import { Button } from '../components/ui/button';
import { StatusBadge, Tag } from '../components/ui/badge';
import { Tabs } from '../components/ui/tabs';
import { RiskMeter } from '../components/ui/risk-meter';
import { ScanReport, parseScanFlags } from '../components/ui/scan-report';
import { EmptyState } from '../components/ui/empty-state';
import { ConfirmDialog } from '../components/forms';

type Filter = 'pending' | 'flagged' | 'all';

interface Target {
  submission: Submission;
  skill?: AiSkill;
  server?: McpServer;
  error?: string;
}

function MetricsStrip({ m }: { m: Metrics }) {
  const tiles = [
    { label: 'Pending review', value: m.queue.pending, sub: `${m.queue.flagged_pending} flagged by scanner` },
    { label: 'Live servers', value: m.servers.live, sub: `${m.servers.unverified} unverified · ${m.servers.deleted} removed` },
    { label: 'Live skills', value: m.skills.live, sub: `${m.skills.unverified} unverified · ${m.skills.deleted} removed` },
    { label: 'Users', value: m.users.total, sub: Object.entries(m.users.by_role).map(([r, n]) => `${n} ${r}`).join(' · ') },
    {
      label: 'Configs generated',
      value: m.configs.total,
      sub: Object.entries(m.configs.by_client).map(([c, n]) => `${clientLabel(c)} ${n}`).join(' · ') || 'none yet',
    },
  ];
  return (
    <ul className="metrics" aria-label="Registry metrics">
      {tiles.map((t) => (
        <li key={t.label} className="metric">
          <span className="cf-field__label">{t.label}</span>
          <b className="metric__value">{t.value}</b>
          <span className="metric__sub">{t.sub}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminView() {
  const { user, ready, requestSignIn } = useSession();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [target, setTarget] = useState<Target | null>(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [takingDown, setTakingDown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    try {
      const [m, s] = await Promise.all([
        api.fetchMetrics(),
        api.fetchSubmissions(
          filter === 'all' ? {} : filter === 'flagged' ? { status: 'pending', flagged_by_scan: true } : { status: 'pending' }
        ),
      ]);
      setMetrics(m);
      setSubmissions(s.data);
    } catch (err) {
      setError(errorText(err));
    }
  }, [isAdmin, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Scanner hits first, then pending, then longest waiting (UX.md Persona D).
  const queue = useMemo(
    () =>
      [...(submissions ?? [])].sort(
        (a, b) =>
          Number(b.flagged_by_scan) - Number(a.flagged_by_scan) ||
          Number(b.status === 'pending') - Number(a.status === 'pending') ||
          new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime()
      ),
    [submissions]
  );

  const open = async (submission: Submission) => {
    setTarget({ submission });
    setNotes('');
    setNotesError(null);
    try {
      if (submission.item_type === 'skill') setTarget({ submission, skill: await api.getSkill(submission.item_id) });
      else setTarget({ submission, server: await api.getServer(submission.item_id) });
    } catch (err) {
      setTarget({ submission, error: errorText(err) });
    }
  };

  const review = async (status: 'approved' | 'rejected') => {
    if (!target) return;
    const text = notes.trim();
    if (status === 'rejected' && !text) {
      setNotesError('Write the reason for rejection. The developer sees this note.');
      return;
    }
    try {
      await api.reviewSubmission({
        item_type: target.submission.item_type,
        item_id: target.submission.item_id,
        status,
        review_notes: text || `Approved by ${user?.email}`,
      });
      toast(`${target.skill?.name ?? target.server?.name ?? 'Item'} ${status}.`);
      setTarget(null);
      load();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.syncGithub();
      toast(
        `GitHub sync: ${r.updated} updated, ${r.failed.length} failed, ${r.skipped} skipped of ${r.checked}.` +
          (r.failed[0] ? ` First failure: ${r.failed[0].name} (${r.failed[0].reason}).` : ''),
        r.failed.length ? 'error' : 'ok'
      );
      load();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (!ready) return <section className="section pg"><div className="skeleton skeleton--detail" aria-busy="true" /></section>;

  if (!isAdmin) {
    return (
      <section className="section pg">
        <EmptyState
          heading={user ? 'Admins only' : 'Sign in as an admin'}
          action={
            !user && (
              <Button variant="primary" size="sm" onClick={requestSignIn}>
                Sign in
              </Button>
            )
          }
        >
          {user
            ? `You are signed in as ${user.role}. The API answers 403 for this area; ask an admin to review your submissions.`
            : 'The review queue, metrics and takedown tools need an admin account.'}
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="section pg" aria-labelledby="admin-h">
      <div className="sec-h">
        <div>
          <h2 id="admin-h">Governance</h2>
          <p>Scanner hits jump the queue. Open an item to see its findings; rejecting requires a note.</p>
        </div>
        <div className="cf-row">
          <Button variant="quiet" size="sm" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" icon={Github} onClick={sync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync GitHub stats'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <Button variant="quiet" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {metrics ? <MetricsStrip m={metrics} /> : <div className="skeleton skeleton--metrics" aria-busy="true" />}

      <Tabs
        label="Queue filter"
        value={filter}
        onChange={(id) => {
          setFilter(id as Filter);
          setTarget(null);
        }}
        items={[
          { id: 'pending', label: 'Pending', count: metrics?.queue.pending },
          { id: 'flagged', label: 'Flagged', count: metrics?.queue.flagged_pending },
          { id: 'all', label: 'All decisions' },
        ]}
      />

      <div className="ws-body">
        {submissions === null ? (
          <div className="skeleton skeleton--rows" aria-busy="true" aria-label="Loading queue" />
        ) : queue.length === 0 ? (
          <EmptyState heading="Review queue cleared" tone="ok">
            Nothing waiting in this view. New submissions and owner edits land here.
          </EmptyState>
        ) : (
          <div className="review">
            <ul className="queue">
              {queue.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="queue__row"
                    aria-current={target?.submission.id === s.id ? 'true' : undefined}
                    onClick={() => open(s)}
                  >
                    <Tag>{s.item_type}</Tag>
                    <span className="queue__id">{s.review_notes ?? s.item_id}</span>
                    {s.flagged_by_scan && <StatusBadge tone="alert">LLM01</StatusBadge>}
                    <StatusBadge tone={s.status === 'pending' ? 'idle' : s.status === 'approved' ? 'live' : 'alert'}>
                      {s.status}
                    </StatusBadge>
                  </button>
                </li>
              ))}
            </ul>

            {target ? (
              <ReviewPanel
                target={target}
                notes={notes}
                notesError={notesError}
                onNotesChange={(v) => {
                  setNotes(v);
                  setNotesError(null);
                }}
                onReview={review}
                onTakedown={() => setTakingDown(true)}
              />
            ) : (
              <EmptyState heading="Select a submission">
                Pick an item on the left to see its scan findings and source before deciding.
              </EmptyState>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={takingDown}
        title={`Take down ${target?.skill?.name ?? target?.server?.name ?? 'item'}?`}
        body="It is unverified and soft deleted immediately, and the reason is written to the audit log. Existing config snapshots are not changed."
        confirmLabel="Take down"
        reason={{ label: 'Reason (kept in the audit log)', min: 5 }}
        onClose={() => setTakingDown(false)}
        onConfirm={async (reason) => {
          if (!target) return;
          try {
            await api.takedown(target.submission.item_type, target.submission.item_id, reason);
            toast('Item taken down and logged.');
            setTarget(null);
            load();
          } catch (err) {
            toast(errorText(err), 'error');
          }
        }}
      />
    </section>
  );
}

interface ReviewPanelProps {
  target: Target;
  notes: string;
  notesError: string | null;
  onNotesChange: (v: string) => void;
  onReview: (status: 'approved' | 'rejected') => void;
  onTakedown: () => void;
}

function ReviewPanel({ target, notes, notesError, onNotesChange, onReview, onTakedown }: ReviewPanelProps) {
  const { submission, skill, server, error } = target;
  const pending = submission.status === 'pending';
  const scan = skill?.scan_flags;
  const item = skill ?? server;
  const detailHref = skill ? href.skill(skill.id) : server ? href.server(server.id) : undefined;

  return (
    <div className="panel" aria-live="polite">
      {skill && (
        <ScanReport name={skill.name} score={scan?.riskScore ?? 0} flags={parseScanFlags(scan?.flags)} excerpt={skill.skill_content} />
      )}
      <dl>
        <dt>Type</dt>
        <dd>{submission.item_type === 'skill' ? 'Skill' : 'MCP server'}</dd>
        <dt>Item</dt>
        <dd className="cf-mono">
          {detailHref ? (
            <a className="ext-link" href={detailHref}>
              {item?.name} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : (
            submission.item_id
          )}
        </dd>
        {server && (
          <>
            <dt>Install</dt>
            <dd className="cf-mono">{server.install_command}</dd>
          </>
        )}
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
          <StatusBadge tone={pending ? 'idle' : submission.status === 'approved' ? 'live' : 'alert'}>{submission.status}</StatusBadge>
        </dd>
        {submission.review_notes && (
          <>
            <dt>Notes</dt>
            <dd>{submission.review_notes}</dd>
          </>
        )}
      </dl>
      {error && <p className="panel__note panel__err">{error}</p>}
      {!item && !error && <p className="panel__note loading">Loading item…</p>}
      {pending && item && (
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
      {!pending && item && item.is_verified && (
        <div className="panel__acts">
          <Button variant="ghost" icon={ShieldOff} onClick={onTakedown}>
            Emergency takedown
          </Button>
        </div>
      )}
    </div>
  );
}
