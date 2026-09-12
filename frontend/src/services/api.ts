export interface McpServer {
  id: string;
  name: string;
  description: string | null;
  repository_url: string | null;
  install_command: string;
  required_env_vars: string[];
  downloads_count: number;
  github_stars: number;
  is_verified: boolean;
  _count?: { tools: number };
}

export interface AiSkill {
  id: string;
  name: string;
  description: string | null;
  skill_content: string;
  compatible_clients: string[];
  tags: string[];
  is_verified: boolean;
  downloads_count: number;
  scan_flags?: {
    prompt_injection_detected?: boolean;
    suspicious_patterns?: string[];
  };
}

export interface GeneratedConfig {
  id: string;
  client_type: string;
  generated_json: Record<string, any>;
  selected_server_ids: string[];
  selected_skill_ids: string[];
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'public' | 'developer' | 'admin';
}

const API_BASE = '/api/v1';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchServers(search?: string): Promise<McpServer[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('limit', '50');

  const res = await fetch(`${API_BASE}/servers?${params.toString()}`);
  const data = await res.json();
  return data.success ? data.data : [];
}

export async function fetchSkills(search?: string, client?: string): Promise<AiSkill[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (client && client !== 'all') params.append('client', client);
  params.append('limit', '50');

  const res = await fetch(`${API_BASE}/skills?${params.toString()}`);
  const data = await res.json();
  return data.success ? data.data : [];
}

export async function generateConfigSnapshot(
  clientType: string,
  selectedServerIds: string[],
  selectedSkillIds: string[],
  token?: string
): Promise<GeneratedConfig> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/configs/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_type: clientType,
      selected_server_ids: selectedServerIds,
      selected_skill_ids: selectedSkillIds,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to generate configuration');
  }
  return data.data;
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Authentication failed');
  }
  return data.data;
}

export async function fetchMe(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch profile');
  }
  return data.data;
}

export async function fetchAdminSubmissions(token: string) {
  const res = await fetch(`${API_BASE}/admin/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch submissions');
  }
  return data.data;
}

export async function reviewSubmission(
  token: string,
  payload: { item_type: 'server' | 'skill'; item_id: string; status: 'approved' | 'rejected'; review_notes?: string }
) {
  const res = await fetch(`${API_BASE}/admin/submissions/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Review failed');
  }
  return data.data;
}
