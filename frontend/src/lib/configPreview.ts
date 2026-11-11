import type { ClientId, McpServer, RiskLevel } from '../services/api';

/**
 * Client-side preview of the config the API will generate. Mirrors splitCommand and the env
 * placeholder rule in backend/src/services/configGenerator.service.ts; the real file always
 * comes from POST /configs/generate.
 */
export function splitCommand(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export const CONFIG_PATHS: Record<ClientId, string> = {
  claude_desktop: 'claude_desktop_config.json',
  cursor: '.cursor/mcp.json',
  cline: 'cline_mcp_settings.json',
  antigravity: 'mcp_config.json',
};

export function previewConfig(client: ClientId, servers: Pick<McpServer, 'name' | 'install_command' | 'required_env_vars'>[]) {
  const mcpServers: Record<string, unknown> = {};
  for (const s of servers) {
    const [command = 'npx', ...args] = splitCommand(s.install_command);
    const env = Object.fromEntries((s.required_env_vars ?? []).map((v) => [v, `YOUR_${v}_HERE`]));
    mcpServers[s.name] = {
      command,
      args,
      ...(Object.keys(env).length && { env }),
      ...(client === 'cline' && { disabled: false, autoApprove: [] }),
    };
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

export const RISK_ORDER: RiskLevel[] = ['read_only', 'network', 'filesystem', 'destructive'];
export const RISK_LABEL: Record<RiskLevel, string> = {
  read_only: 'Read only',
  network: 'Network',
  filesystem: 'Filesystem',
  destructive: 'Destructive',
};
export const RISK_MEANING: Record<RiskLevel, string> = {
  read_only: 'Reads data, changes nothing',
  network: 'Calls the internet or an API',
  filesystem: 'Reads or writes files on your machine',
  destructive: 'Can delete, overwrite or run code',
};

export function highestRisk(servers: Pick<McpServer, 'tools'>[]): RiskLevel | null {
  let max = -1;
  for (const s of servers) for (const t of s.tools ?? []) max = Math.max(max, RISK_ORDER.indexOf(t.risk_level));
  return max < 0 ? null : RISK_ORDER[max];
}
