import { describe, it, expect } from 'vitest';
import { ConfigGenerator } from '../services/configGenerator.service.js';

describe('ConfigGenerator (Multi-Client Unified Config)', () => {
  const mockServers = [
    {
      id: 'srv-1',
      name: 'postgres',
      install_command: 'npx -y @modelcontextprotocol/server-postgres',
      required_env_vars: ['DATABASE_URL', 'PG_PASSWORD'],
    },
  ];

  const mockSkills = [
    {
      id: 'skl-1',
      name: 'tdd-playbook',
      skill_content: '# TDD Playbook\nAlways write red test first.',
    },
  ];

  it('should generate valid Claude Desktop configuration format', () => {
    const config = ConfigGenerator.generate('claude_desktop', mockServers, mockSkills);

    expect(config).toHaveProperty('mcpServers');
    expect(config.mcpServers).toHaveProperty('postgres');
    expect(config.mcpServers.postgres.command).toBe('npx');
    expect(config.mcpServers.postgres.args).toContain('-y');
    expect(config.mcpServers.postgres.env).toEqual({
      DATABASE_URL: 'YOUR_DATABASE_URL_HERE',
      PG_PASSWORD: 'YOUR_PG_PASSWORD_HERE',
    });
    expect(config.skills.length).toBe(1);
    expect(config.skills[0].name).toBe('tdd-playbook');
  });

  it('should generate valid Cursor configuration format', () => {
    const config = ConfigGenerator.generate('cursor', mockServers, mockSkills);

    expect(config).toHaveProperty('mcpServers');
    expect(config.mcpServers.postgres.command).toBe('npx');
    expect(config.skills[0].content).toContain('Always write red test first');
  });
});
