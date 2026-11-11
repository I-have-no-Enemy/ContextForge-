export interface McpServerRecord {
  name: string;
  install_command: string;
  required_env_vars: unknown;
}

export interface AiSkillRecord {
  name: string;
  description?: string | null;
  skill_content: string;
}

export type ClientType = 'claude_desktop' | 'cursor' | 'cline' | 'antigravity';

export interface SkillFile {
  name: string;
  path: string;
  content: string;
}

export interface GeneratedConfig {
  client: ClientType;
  /** Where the config file goes, as the client documents it. */
  config_path: string;
  /** Exact file content. Contains only keys the client reads. */
  config: { mcpServers: Record<string, McpEntry> };
  /** Skills as files the client loads natively (SKILL.md folders or rule files). */
  skill_files: SkillFile[];
  instructions: string;
}

interface McpEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

/** Splits a command line the way a POSIX shell would for plain words and quotes. */
export function splitCommand(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const hasFrontmatter = (s: string) => s.startsWith('---\n') || s.startsWith('---\r\n');
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

function describe(skill: AiSkillRecord) {
  return oneLine(skill.description || skill.skill_content.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '') || skill.name);
}

/** SKILL.md format: YAML frontmatter with name and description, then the body. */
function skillMd(skill: AiSkillRecord) {
  if (hasFrontmatter(skill.skill_content)) return skill.skill_content;
  return `---\nname: ${skill.name}\ndescription: ${describe(skill)}\n---\n\n${skill.skill_content}`;
}

/** Cursor project rule (.mdc): description + alwaysApply frontmatter. */
function cursorRule(skill: AiSkillRecord) {
  const body = hasFrontmatter(skill.skill_content) ? skill.skill_content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '') : skill.skill_content;
  return `---\ndescription: ${describe(skill)}\nalwaysApply: false\n---\n\n${body.trimStart()}`;
}

const CLIENTS: Record<
  ClientType,
  { path: string; skill: (s: AiSkillRecord) => SkillFile; extra?: Partial<McpEntry>; instructions: string }
> = {
  claude_desktop: {
    path: 'claude_desktop_config.json',
    skill: (s) => ({ name: s.name, path: `skills/${s.name}/SKILL.md`, content: skillMd(s) }),
    instructions:
      'Settings > Developer > Edit Config opens claude_desktop_config.json (Windows: %APPDATA%\\Claude, macOS: ~/Library/Application Support/Claude). Replace each YOUR_..._HERE value, save, restart Claude. Zip each skills/<name> folder and upload it under Settings > Capabilities > Skills.',
  },
  cursor: {
    path: '.cursor/mcp.json',
    skill: (s) => ({ name: s.name, path: `.cursor/rules/${s.name}.mdc`, content: cursorRule(s) }),
    instructions:
      'Save the config as .cursor/mcp.json in your project (or ~/.cursor/mcp.json for every project). Put each rule file in .cursor/rules/. Replace each YOUR_..._HERE value, then enable the servers under Settings > MCP.',
  },
  cline: {
    path: 'cline_mcp_settings.json',
    extra: { disabled: false, autoApprove: [] },
    skill: (s) => ({ name: s.name, path: `.clinerules/${s.name}.md`, content: s.skill_content }),
    instructions:
      'In Cline open MCP Servers > Configure MCP Servers and paste the mcpServers entries into cline_mcp_settings.json. Put each rule file in the .clinerules/ folder of your workspace. Replace each YOUR_..._HERE value.',
  },
  antigravity: {
    path: '~/.gemini/antigravity/mcp_config.json',
    skill: (s) => ({ name: s.name, path: `.agents/skills/${s.name}/SKILL.md`, content: skillMd(s) }),
    instructions:
      'Open Manage MCP Servers > View raw config (mcp_config.json) and merge the mcpServers entries. Put each skill folder under .agents/skills/ in your workspace. Replace each YOUR_..._HERE value.',
  },
};

export class ConfigGenerator {
  /** Builds the exact files a client loads for the selected servers and skills. */
  public static generate(clientType: ClientType, servers: McpServerRecord[], skills: AiSkillRecord[]): GeneratedConfig {
    const client = CLIENTS[clientType];
    if (!client) throw new Error(`Unsupported client: ${clientType}`);

    const mcpServers: Record<string, McpEntry> = {};
    for (const server of servers) {
      const [command = 'npx', ...args] = splitCommand(server.install_command);
      const names = Array.isArray(server.required_env_vars)
        ? server.required_env_vars.filter((v): v is string => typeof v === 'string')
        : [];
      // Only variable names are stored; values are placeholders the user fills in locally.
      const env = Object.fromEntries(names.map((v) => [v, `YOUR_${v}_HERE`]));
      mcpServers[server.name] = { command, args, ...(names.length && { env }), ...client.extra };
    }

    return {
      client: clientType,
      config_path: client.path,
      config: { mcpServers },
      skill_files: skills.map(client.skill),
      instructions: client.instructions,
    };
  }
}
