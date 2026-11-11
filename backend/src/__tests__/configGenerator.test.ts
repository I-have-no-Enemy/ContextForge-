import { describe, it, expect } from 'vitest';
import { ConfigGenerator, splitCommand } from '../services/configGenerator.service.js';

const servers = [
  {
    name: 'filesystem',
    install_command: 'npx -y @modelcontextprotocol/server-filesystem "C:/Users/me/My Projects"',
    required_env_vars: [],
  },
  {
    name: 'github',
    install_command: 'npx -y @modelcontextprotocol/server-github',
    required_env_vars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
  },
];

const skills = [
  { name: 'tdd-loop', description: 'Red, green, refactor in small steps.', skill_content: '# TDD loop\n\nWrite the failing test first.' },
  {
    name: 'has-frontmatter',
    description: 'ignored',
    skill_content: '---\nname: has-frontmatter\ndescription: Own frontmatter.\n---\n\n# Body',
  },
];

describe('splitCommand', () => {
  it('keeps quoted arguments together', () => {
    expect(splitCommand('npx -y pkg "a b" \'c d\' e')).toEqual(['npx', '-y', 'pkg', 'a b', 'c d', 'e']);
  });
  it('collapses repeated whitespace', () => {
    expect(splitCommand('  uvx   mcp-server-fetch  ')).toEqual(['uvx', 'mcp-server-fetch']);
  });
});

describe('ConfigGenerator output matches each client file format', () => {
  it('Claude Desktop: only mcpServers in the config, skills as SKILL.md folders', () => {
    const out = ConfigGenerator.generate('claude_desktop', servers, skills);

    expect(out.config_path).toBe('claude_desktop_config.json');
    expect(Object.keys(out.config)).toEqual(['mcpServers']);
    expect(out.config.mcpServers.filesystem).toEqual({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/Users/me/My Projects'],
    });
    expect(out.config.mcpServers.github.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE' });
    expect(out.skill_files[0].path).toBe('skills/tdd-loop/SKILL.md');
  });

  it('SKILL.md gets name/description frontmatter unless it already has one', () => {
    const out = ConfigGenerator.generate('claude_desktop', [], skills);
    expect(out.skill_files[0].content.startsWith('---\nname: tdd-loop\ndescription: Red, green, refactor in small steps.\n---\n')).toBe(true);
    expect(out.skill_files[1].content).toBe(skills[1].skill_content);
  });

  it('Cursor: .cursor/mcp.json and skills as .mdc project rules', () => {
    const out = ConfigGenerator.generate('cursor', servers, skills);
    expect(out.config_path).toBe('.cursor/mcp.json');
    expect(out.skill_files[0].path).toBe('.cursor/rules/tdd-loop.mdc');
    expect(out.skill_files[0].content).toMatch(/^---\ndescription: Red, green, refactor in small steps\.\nalwaysApply: false\n---\n/);
  });

  it('Cline: entries carry disabled and autoApprove, skills as .clinerules files', () => {
    const out = ConfigGenerator.generate('cline', servers, skills);
    expect(out.config_path).toBe('cline_mcp_settings.json');
    expect(out.config.mcpServers.github).toMatchObject({ disabled: false, autoApprove: [] });
    expect(out.skill_files[0].path).toBe('.clinerules/tdd-loop.md');
  });

  it('Antigravity: mcp_config.json without invented keys, skills in .agents/skills', () => {
    const out = ConfigGenerator.generate('antigravity', servers, skills);
    expect(out.config_path).toBe('~/.gemini/antigravity/mcp_config.json');
    expect(out.config).not.toHaveProperty('$schema');
    expect(Object.keys(out.config)).toEqual(['mcpServers']);
    expect(out.skill_files[0].path).toBe('.agents/skills/tdd-loop/SKILL.md');
  });

  it('never emits a real secret value, only placeholders for declared env names', () => {
    const json = JSON.stringify(ConfigGenerator.generate('cursor', servers, []));
    expect(json).toContain('YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE');
    expect(Object.keys(ConfigGenerator.generate('cursor', servers, []).config.mcpServers.filesystem)).not.toContain('env');
  });

  it('empty selection gives an empty mcpServers object and no files', () => {
    const out = ConfigGenerator.generate('cline', [], []);
    expect(out.config).toEqual({ mcpServers: {} });
    expect(out.skill_files).toEqual([]);
  });

  it('rejects an unknown client', () => {
    expect(() => ConfigGenerator.generate('vim' as any, [], [])).toThrow(/Unsupported client/);
  });
});
