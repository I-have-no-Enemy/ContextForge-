import { useState } from 'react';
import * as api from '../services/api';
import type { ImportSummary } from '../services/api';
import { errorText, useToast } from '../lib/toast';
import { Button } from './ui/button';
import { ConfirmDialog, Field } from './forms';
import { Github } from './icons';

const EXAMPLES: Record<'skill' | 'mcp', string> = {
  skill: 'https://github.com/ComposioHQ/awesome-claude-skills',
  mcp: 'https://github.com/modelcontextprotocol/servers',
};

/** Admin tool: read skills or MCP servers from a public GitHub URL into the review queue. */
export function ImportPanel({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<'skill' | 'mcp'>('skill');
  const [limit, setLimit] = useState('20');
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [approving, setApproving] = useState(false);

  const run = async (dry: boolean) => {
    const address = url.trim();
    if (!/^https:\/\/github\.com\/[^\s]+$/.test(address)) {
      setError('Paste a GitHub address: a repository, a folder inside one, or a topic page.');
      return;
    }
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setError('Limit must be a whole number from 1 to 100.');
      return;
    }
    setError(undefined);
    setBusy(dry ? 'preview' : 'import');
    try {
      const r = await api.importGithub({ url: address, kind, limit: n, dry_run: dry });
      setResult(r);
      if (!dry) {
        toast(`${r.created.length} queued for review, ${r.skipped.length} skipped.`, r.failed.length ? 'error' : 'ok');
        onDone();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="import" aria-labelledby="import-h">
      <div>
        <h3 id="import-h" className="import__h">
          Import from GitHub
        </h3>
        <p className="form__lead">
          Reads public files through the GitHub API. Everything lands in the queue as unverified with its source and license; nothing is
          approved here.
        </p>
      </div>

      <form
        className="import__form"
        onSubmit={(e) => {
          e.preventDefault();
          run(false);
        }}
      >
        <Field label="GitHub address" error={error} hint="Repository, tree path or topic, for example github.com/topics/agent-skills.">
          {(p) => (
            <input
              {...p}
              className="cf-input cf-mono"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={EXAMPLES[kind]}
            />
          )}
        </Field>
        <div className="import__row">
          <Field label="Import as">
            {(p) => (
              <select {...p} className="cf-select" value={kind} onChange={(e) => setKind(e.target.value as 'skill' | 'mcp')}>
                <option value="skill">AI skills (SKILL.md)</option>
                <option value="mcp">MCP servers (README)</option>
              </select>
            )}
          </Field>
          <Field label="Up to">
            {(p) => (
              <input {...p} className="cf-input cf-mono" type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(e.target.value)} />
            )}
          </Field>
        </div>
        <div className="cf-row">
          <Button type="button" variant="ghost" size="sm" icon={Github} onClick={() => run(true)} disabled={busy !== null}>
            {busy === 'preview' ? 'Reading…' : 'Preview'}
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={busy !== null}>
            {busy === 'import' ? 'Importing…' : 'Import to queue'}
          </Button>
          <Button type="button" variant="quiet" size="sm" onClick={() => setApproving(true)}>
            Approve all scanner-clean imports
          </Button>
        </div>
      </form>

      {result && (
        <div className="import__result" role="status" aria-live="polite">
          <p>
            <b>{result.created.length}</b> {result.dry_run ? 'would be created' : 'queued for review'} · <b>{result.skipped.length}</b> skipped ·{' '}
            <b>{result.failed.length}</b> failed · {result.api_calls} GitHub calls
            {result.rate_remaining !== null && ` (${result.rate_remaining} left this hour)`}
          </p>
          {result.partial && <p className="form-field__err">{result.stopped_reason}</p>}
          {result.created.length > 0 && (
            <details>
              <summary>{result.dry_run ? 'Would create' : 'Created'}</summary>
              <ul className="import__list">
                {result.created.map((c) => (
                  <li key={c.source_url}>
                    <span className="cf-mono">{c.name}</span>
                    <span className="cf-muted">
                      {' '}
                      {c.license ?? 'no license'}
                      {c.tools !== undefined && ` · ${c.tools} tools`}
                      {c.flagged_by_scan && ' · scanner flagged'}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.skipped.length + result.failed.length > 0 && (
            <details>
              <summary>Skipped and failed, with reasons</summary>
              <ul className="import__list">
                {[...result.failed.map((f) => ({ ...f, tag: 'failed' })), ...result.skipped.map((f) => ({ ...f, tag: 'skipped' }))].slice(0, 60).map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <span className="cf-mono">{s.name}</span>
                    <span className="cf-muted">
                      {' '}
                      {s.tag}: {s.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <ConfirmDialog
        open={approving}
        title="Approve every scanner-clean import?"
        body="Publishes all pending imported skills and MCP servers that the scanner did not flag, in one decision recorded under your account. Flagged items stay in the queue. Tool risk levels on imported MCP servers are keyword guesses, so open a few and check them first."
        confirmLabel="Approve and publish"
        onClose={() => setApproving(false)}
        onConfirm={async () => {
          try {
            const [skills, servers] = [await api.approveClean('skill'), await api.approveClean('server')];
            toast(
              `Approved ${skills.approved} skills and ${servers.approved} servers; ${skills.left_in_queue_flagged + servers.left_in_queue_flagged} flagged left in the queue.`
            );
            onDone();
          } catch (err) {
            toast(errorText(err), 'error');
          }
        }}
      />
    </section>
  );
}
