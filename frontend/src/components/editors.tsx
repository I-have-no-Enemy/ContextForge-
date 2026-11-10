import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import * as api from '../services/api';
import type { AiSkill, McpServer, RiskLevel, ScanResult } from '../services/api';
import { ApiError } from '../services/api';
import { useToast } from '../lib/toast';
import { CLIENTS } from '../lib/cart';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Tag } from './ui/badge';
import { RISK_ORDER } from './ui/risk-meter';
import { ScanReport, parseScanFlags } from './ui/scan-report';
import { Field, splitList } from './forms';

type Errors = Record<string, string>;

/** Shared submit flow: local checks, API call, field errors from VALIDATION_ERROR, toast on success. */
function useSubmit<T>(onDone: (value: T) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();

  const run = async (local: Errors, call: () => Promise<T>, okText: string) => {
    setErrors(local);
    setFormError(undefined);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const value = await call();
      toast(okText);
      onDone(value);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.fieldErrors());
      else setFormError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, formError, run, setErrors };
}

const NAME_RULE = /^[a-z0-9-_]{3,100}$/;
const NAME_HINT = 'Lowercase letters, numbers, - and _. Used as the key in the generated config.';

function FormFooter({ busy, label, onCancel, formId }: { busy: boolean; label: string; onCancel: () => void; formId: string }) {
  return (
    <>
      <Button variant="quiet" size="sm" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button variant="primary" size="sm" type="submit" form={formId} disabled={busy}>
        {busy ? 'Saving…' : label}
      </Button>
    </>
  );
}

function ReReviewNote({ editing }: { editing: boolean }) {
  return (
    <p className="form__lead">
      {editing
        ? 'Saving sends this item back to the review queue. It leaves the public registry until an admin approves it again.'
        : 'New submissions start unverified and appear publicly after an admin approves them.'}
    </p>
  );
}

// ---------------------------------------------------------------- Server

export function ServerEditor({
  open,
  server,
  onClose,
  onSaved,
}: {
  open: boolean;
  server?: McpServer;
  onClose: () => void;
  onSaved: (s: McpServer) => void;
}) {
  const editing = Boolean(server);
  const [form, setForm] = useState({ name: '', description: '', repository_url: '', install_command: '', env: '' });
  const { busy, errors, formError, run } = useSubmit<McpServer>((s) => {
    onSaved(s);
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: server?.name ?? '',
      description: server?.description ?? '',
      repository_url: server?.repository_url ?? '',
      install_command: server?.install_command ?? '',
      env: (server?.required_env_vars ?? []).join(', '),
    });
  }, [open, server]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const env = splitList(form.env).map((v) => v.toUpperCase());
    const local: Errors = {};
    if (!NAME_RULE.test(form.name)) local.name = NAME_HINT;
    if (form.install_command.trim().length < 3) local.install_command = 'Enter the command a client runs, e.g. npx -y @scope/server.';
    if (form.repository_url && !/^https?:\/\//.test(form.repository_url)) local.repository_url = 'Use a full URL starting with https://.';
    if (env.some((v) => !/^[A-Z0-9_]+$/.test(v))) local.required_env_vars = 'Names only: A-Z, 0-9 and _. Never paste the secret value.';
    const input: api.ServerInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      repository_url: form.repository_url.trim() || undefined,
      install_command: form.install_command.trim(),
      required_env_vars: env,
    };
    run(local, () => (server ? api.updateServer(server.id, input) : api.createServer(input)), editing ? 'Server saved and sent for review.' : 'Server submitted for review.');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={editing ? `Edit ${server?.name}` : 'Submit an MCP server'}
      footer={<FormFooter busy={busy} label={editing ? 'Save changes' : 'Submit for review'} onCancel={onClose} formId="server-form" />}
    >
      <form id="server-form" className="form" onSubmit={submit} noValidate>
        <ReReviewNote editing={editing} />
        <Field label="Name" error={errors.name} hint={NAME_HINT}>
          {(p) => <input {...p} className="cf-input cf-mono" value={form.name} onChange={set('name')} placeholder="postgres-inspector" />}
        </Field>
        <Field label="Install command" error={errors.install_command} hint="Runs on the user's machine, never on ContextForge.">
          {(p) => (
            <input {...p} className="cf-input cf-mono" value={form.install_command} onChange={set('install_command')} placeholder="npx -y @modelcontextprotocol/server-postgres" />
          )}
        </Field>
        <Field label="Description" error={errors.description}>
          {(p) => <textarea {...p} className="cf-input" rows={3} value={form.description} onChange={set('description')} />}
        </Field>
        <Field label="Repository URL" error={errors.repository_url} hint="GitHub URLs get star and contributor counts.">
          {(p) => <input {...p} className="cf-input" type="url" value={form.repository_url} onChange={set('repository_url')} placeholder="https://github.com/owner/repo" />}
        </Field>
        <Field label="Required env vars" error={errors.required_env_vars} hint="Comma separated names, e.g. DATABASE_URL, API_KEY. Configs get placeholders.">
          {(p) => <input {...p} className="cf-input cf-mono" value={form.env} onChange={set('env')} />}
        </Field>
        {formError && <p className="form__error" role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Tool

export function ToolEditor({
  open,
  serverId,
  onClose,
  onSaved,
}: {
  open: boolean;
  serverId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: '', description: '', risk_level: 'read_only' as RiskLevel, schema: '{\n  "type": "object",\n  "properties": {}\n}' });
  const { busy, errors, formError, run } = useSubmit<unknown>(() => {
    onSaved();
    onClose();
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, name: '', description: '' }));
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local: Errors = {};
    let schema: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(form.schema || '{}');
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) throw new Error();
      schema = parsed;
    } catch {
      local.input_schema = 'Must be a JSON object, e.g. {"type":"object"}.';
    }
    if (form.name.trim().length < 2) local.name = 'At least 2 characters, e.g. query_database.';
    run(
      local,
      () => api.addTool(serverId, { name: form.name.trim(), description: form.description.trim() || undefined, risk_level: form.risk_level, input_schema: schema }),
      'Tool added. The server goes back to review.'
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title="Add a tool"
      footer={<FormFooter busy={busy} label="Add tool" onCancel={onClose} formId="tool-form" />}
    >
      <form id="tool-form" className="form" onSubmit={submit} noValidate>
        <Field label="Tool name" error={errors.name}>
          {(p) => <input {...p} className="cf-input cf-mono" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="query_database" />}
        </Field>
        <Field label="Description" error={errors.description}>
          {(p) => <input {...p} className="cf-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <Field label="Risk level" error={errors.risk_level} hint="The highest level a tool can reach on the host. destructive = can delete or execute.">
          {(p) => (
            <select {...p} className="cf-select" value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value as RiskLevel })}>
              {RISK_ORDER.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Input schema (JSON)" error={errors.input_schema}>
          {(p) => <textarea {...p} className="cf-input cf-mono" rows={6} value={form.schema} onChange={(e) => setForm({ ...form, schema: e.target.value })} />}
        </Field>
        {formError && <p className="form__error" role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Skill

export function SkillEditor({
  open,
  skill,
  onClose,
  onSaved,
}: {
  open: boolean;
  skill?: AiSkill;
  onClose: () => void;
  onSaved: (s: AiSkill) => void;
}) {
  const editing = Boolean(skill);
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', content: '', tags: '', clients: CLIENTS.map((c) => c.id) as string[] });
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const { busy, errors, formError, run } = useSubmit<AiSkill>((s) => {
    onSaved(s);
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    setScan(null);
    setForm({
      name: skill?.name ?? '',
      description: skill?.description ?? '',
      content: skill?.skill_content ?? '',
      tags: (skill?.tags ?? []).join(', '),
      clients: skill?.compatible_clients ?? CLIENTS.map((c) => c.id),
    });
  }, [open, skill]);

  const runScan = async () => {
    if (!form.content.trim()) return;
    setScanning(true);
    try {
      setScan(await api.scanSkill(form.content));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Scan failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local: Errors = {};
    if (!NAME_RULE.test(form.name)) local.name = NAME_HINT;
    if (form.content.trim().length < 10) local.skill_content = 'Write at least 10 characters of SKILL.md markdown.';
    if (!form.clients.length) local.compatible_clients = 'Pick at least one client.';
    const input: api.SkillInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      skill_content: form.content,
      compatible_clients: form.clients,
      tags: splitList(form.tags),
    };
    run(
      local,
      () => (skill ? api.updateSkill(skill.id, input) : api.createSkill(input)),
      editing ? 'Skill saved, re-scanned and sent for review.' : 'Skill submitted. The scanner result is attached to the review.'
    );
  };

  const toggleClient = (id: string) =>
    setForm((f) => ({ ...f, clients: f.clients.includes(id) ? f.clients.filter((c) => c !== id) : [...f.clients, id] }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={editing ? `Edit ${skill?.name}` : 'Submit a skill'}
      footer={<FormFooter busy={busy} label={editing ? 'Save changes' : 'Submit for review'} onCancel={onClose} formId="skill-form" />}
    >
      <form id="skill-form" className="form" onSubmit={submit} noValidate>
        <ReReviewNote editing={editing} />
        <Field label="Name" error={errors.name} hint={NAME_HINT}>
          {(p) => <input {...p} className="cf-input cf-mono" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="tdd-mastery" />}
        </Field>
        <Field label="Description" error={errors.description}>
          {(p) => <input {...p} className="cf-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <fieldset className="form-field form-fieldset">
          <legend className="cf-field__label">Compatible clients</legend>
          <div className="cf-row" style={{ gap: 8 }}>
            {CLIENTS.map((c) => (
              <Tag key={c.id} pressed={form.clients.includes(c.id)} onClick={() => toggleClient(c.id)}>
                {c.id}
              </Tag>
            ))}
          </div>
          {errors.compatible_clients && <p className="form-field__err">{errors.compatible_clients}</p>}
        </fieldset>
        <Field label="Tags" error={errors.tags} hint="Comma separated, e.g. testing, security.">
          {(p) => <input {...p} className="cf-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />}
        </Field>
        <Field label="SKILL.md content" error={errors.skill_content} hint="Scanned for prompt injection on save (OWASP LLM01).">
          {(p) => (
            <textarea
              {...p}
              className="cf-input cf-mono"
              rows={10}
              value={form.content}
              onChange={(e) => {
                setForm({ ...form, content: e.target.value });
                setScan(null);
              }}
            />
          )}
        </Field>
        <div className="cf-row">
          <Button variant="ghost" size="sm" icon={ShieldCheck} onClick={runScan} disabled={scanning || !form.content.trim()}>
            {scanning ? 'Scanning…' : 'Run scan now'}
          </Button>
          {scan && (
            <span className="cf-mono cf-muted" aria-live="polite">
              {scan.prompt_injection_detected ? `${scan.flags.length} finding(s). This will be flagged for review.` : 'No findings.'}
            </span>
          )}
        </div>
        {scan?.prompt_injection_detected && (
          <ScanReport name={form.name || 'draft'} score={scan.riskScore} flags={parseScanFlags(scan.flags)} excerpt={form.content} />
        )}
        {formError && <p className="form__error" role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}
