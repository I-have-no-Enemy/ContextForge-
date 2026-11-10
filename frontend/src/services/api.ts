/**
 * The only module that talks to the backend. Auth rides on the HttpOnly `token`
 * cookie set by POST /auth/login, so no JWT is ever readable from page scripts.
 */

export type RiskLevel = 'read_only' | 'network' | 'filesystem' | 'destructive';
export type ClientId = 'claude_desktop' | 'cursor' | 'cline' | 'antigravity';
export type Role = 'public' | 'developer' | 'admin';
export type ReviewState = 'pending' | 'approved' | 'rejected';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LatestReview {
  status: ReviewState;
  flagged_by_scan: boolean;
  review_notes: string | null;
  reviewed_at: string;
}

export interface ToolDefinition {
  tool_id: string;
  name: string;
  description?: string | null;
  input_schema?: Record<string, unknown>;
  risk_level: RiskLevel;
}

export interface McpServer {
  server_id: string;
  id: string;
  name: string;
  description: string | null;
  repository_url: string | null;
  install_command: string;
  required_env_vars: string[];
  downloads_count: number;
  github_stars: number;
  github_contributors?: number;
  github_last_synced_at?: string | null;
  is_verified: boolean;
  submitted_by?: string;
  user?: { email: string };
  tools?: ToolDefinition[];
  latest_review?: LatestReview | null;
  updated_at?: string;
}

export interface ScanResult {
  isSafe: boolean;
  prompt_injection_detected: boolean;
  flags: string[];
  riskScore: number;
}

export interface AiSkill {
  skill_id: string;
  id: string;
  name: string;
  description: string | null;
  skill_content: string;
  compatible_clients: string[];
  tags: string[];
  is_verified: boolean;
  downloads_count: number;
  submitted_by?: string;
  user?: { email: string };
  scan_flags?: Partial<ScanResult>;
  latest_review?: LatestReview | null;
  updated_at?: string;
}

export interface Submission {
  review_id: string;
  id: string;
  item_type: 'server' | 'skill';
  item_id: string;
  status: ReviewState;
  flagged_by_scan: boolean;
  review_notes: string | null;
  reviewed_at: string;
}

export interface GeneratedConfig {
  config_id: string;
  id: string;
  client_type: ClientId;
  generated_json: Record<string, any>;
  selected_server_ids: string[];
  selected_skill_ids: string[];
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  id: string;
  email: string;
  role: Role;
}

export interface Metrics {
  users: { total: number; by_role: Record<string, number> };
  servers: { live: number; unverified: number; deleted: number };
  skills: { live: number; unverified: number; deleted: number };
  queue: { pending: number; flagged_pending: number; approved: number; rejected: number };
  configs: { total: number; by_client: Record<string, number> };
  top_servers: { id: string; name: string; downloads_count: number; github_stars: number }[];
  top_skills: { id: string; name: string; downloads_count: number }[];
}

export interface SyncSummary {
  checked: number;
  updated: number;
  skipped: number;
  failed: { server_id: string; name: string; reason: string }[];
}

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }

  /** Field-level messages from a VALIDATION_ERROR, keyed by field name. */
  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as FieldIssue[]).map((d) => [d.field, d.message]));
  }
}

const API_BASE = '/api/v1';

/** Called on any 401 so the session layer can drop a stale login. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {}
): Promise<{ data: T; pagination?: Pagination }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the API. Check that the backend is running on port 5000.');
  }

  if (res.status === 204) return { data: undefined as T };

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `The server answered ${res.status} without JSON.`);
  }

  if (!json.success) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized?.();
    const retry = res.headers.get('Retry-After');
    const message =
      res.status === 429 && retry
        ? `Too many requests. Try again in ${retry} seconds.`
        : json.error?.message ?? 'Request failed.';
    throw new ApiError(res.status, json.error?.code ?? 'ERROR', message, json.error?.details);
  }
  return { data: json.data, pagination: json.pagination };
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'all') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
const enc = encodeURIComponent;
const get = async <T>(path: string) => (await request<T>(path)).data;
const send = async <T>(method: string, path: string, body?: unknown) => (await request<T>(path, { method, body })).data;

// ---- System & auth ----
export const fetchHealth = () => get<{ status: string; uptimeSeconds: number }>('/health');
export const login = (email: string, password: string) =>
  send<{ token: string; user: UserProfile }>('POST', '/auth/login', { email, password });
export const register = (email: string, password: string) =>
  send<{ user: UserProfile }>('POST', '/auth/register', { email, password });
export const fetchMe = async () => (await get<{ user: UserProfile }>('/auth/me')).user;
export const logout = () => send<unknown>('POST', '/auth/logout');

// ---- MCP servers ----
export interface ListQuery {
  search?: string;
  page?: number;
  limit?: number;
  client?: string;
}
export const listServers = (q: ListQuery = {}) => request<McpServer[]>(`/servers${qs({ ...q })}`);
export const myServers = (page = 1) => request<McpServer[]>(`/servers/me${qs({ page, limit: 50 })}`);
export const getServer = (id: string) => get<McpServer>(`/servers/${enc(id)}`);
export interface ServerInput {
  name: string;
  description?: string;
  repository_url?: string;
  install_command: string;
  required_env_vars: string[];
}
export const createServer = (input: ServerInput) => send<McpServer>('POST', '/servers', input);
export const updateServer = (id: string, input: Partial<ServerInput>) => send<McpServer>('PATCH', `/servers/${enc(id)}`, input);
export const deleteServer = (id: string) => send<void>('DELETE', `/servers/${enc(id)}`);
export interface ToolInput {
  name: string;
  description?: string;
  risk_level: RiskLevel;
  input_schema: Record<string, unknown>;
}
export const addTool = (serverId: string, input: ToolInput) => send<ToolDefinition>('POST', `/servers/${enc(serverId)}/tools`, input);
export const deleteTool = (serverId: string, toolId: string) =>
  send<void>('DELETE', `/servers/${enc(serverId)}/tools/${enc(toolId)}`);

// ---- Skills ----
export const listSkills = (q: ListQuery = {}) => request<AiSkill[]>(`/skills${qs({ ...q })}`);
export const mySkills = (page = 1) => request<AiSkill[]>(`/skills/me${qs({ page, limit: 50 })}`);
export const getSkill = (id: string) => get<AiSkill>(`/skills/${enc(id)}`);
export interface SkillInput {
  name: string;
  description?: string;
  skill_content: string;
  compatible_clients: string[];
  tags: string[];
}
export const createSkill = (input: SkillInput) => send<AiSkill>('POST', '/skills', input);
export const updateSkill = (id: string, input: Partial<SkillInput>) => send<AiSkill>('PATCH', `/skills/${enc(id)}`, input);
export const deleteSkill = (id: string) => send<void>('DELETE', `/skills/${enc(id)}`);
export const scanSkill = (skill_content: string) => send<ScanResult>('POST', '/skills/scan', { skill_content });

// ---- Configs ----
export const generateConfig = (client_type: ClientId, selected_server_ids: string[], selected_skill_ids: string[]) =>
  send<GeneratedConfig>('POST', '/configs/generate', { client_type, selected_server_ids, selected_skill_ids });
export const myConfigs = (page = 1) => request<GeneratedConfig[]>(`/configs/me${qs({ page, limit: 20 })}`);

// ---- Admin ----
export const fetchMetrics = () => get<Metrics>('/admin/metrics');
export const fetchSubmissions = (q: { status?: string; flagged_by_scan?: boolean; page?: number } = {}) =>
  request<Submission[]>(`/admin/submissions${qs({ ...q, limit: 50 })}`);
export const reviewSubmission = (payload: {
  item_type: 'server' | 'skill';
  item_id: string;
  status: 'approved' | 'rejected';
  review_notes?: string;
}) => send<Submission>('POST', '/admin/submissions/review', payload);
export const takedown = (item_type: 'server' | 'skill', item_id: string, reason: string) =>
  send<unknown>('POST', '/admin/takedown', { item_type, item_id, reason });
export const syncGithub = () => send<SyncSummary>('POST', '/admin/sync/github');
