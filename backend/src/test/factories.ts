import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { ToolRiskLevel, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getJwtSecret } from '../config/env.js';
import { TABLES, TEST_SCHEMA } from './testDb.js';

/** Empties every table in the test schema. Names are schema-qualified so `public` is never touched. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${TEST_SCHEMA}"."${t}"`).join(', ')} CASCADE`);
}

const uniq = () => randomUUID().slice(0, 8);

export interface TestUser {
  user_id: string;
  email: string;
  role: UserRole;
  password: string;
  /** Value for the Authorization header. */
  auth: string;
}

export async function makeUser(role: UserRole = 'developer', password = 'Passw0rd-test'): Promise<TestUser> {
  // Low cost factor keeps the suite fast; production cost is asserted in env.test.ts.
  const user = await prisma.user.create({
    data: { email: `${role}-${uniq()}@test.local`, password_hash: await bcrypt.hash(password, 4), role },
  });
  const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '1h' });
  return { user_id: user.user_id, email: user.email, role: user.role, password, auth: `Bearer ${token}` };
}

export async function makeServer(
  owner: TestUser,
  opts: { verified?: boolean; deleted?: boolean; name?: string; env?: string[]; repo?: string; tools?: { name: string; risk_level: ToolRiskLevel }[] } = {}
) {
  return prisma.mcpServer.create({
    data: {
      name: opts.name ?? `server-${uniq()}`,
      description: 'Integration test server',
      install_command: 'npx -y @modelcontextprotocol/server-everything',
      repository_url: opts.repo ?? null,
      required_env_vars: opts.env ?? [],
      is_verified: opts.verified ?? true,
      is_deleted: opts.deleted ?? false,
      deleted_at: opts.deleted ? new Date() : null,
      submitted_by: owner.user_id,
      tools: opts.tools ? { create: opts.tools } : undefined,
    },
    include: { tools: true },
  });
}

export async function makeSkill(
  owner: TestUser,
  opts: { verified?: boolean; deleted?: boolean; name?: string; content?: string; clients?: string[] } = {}
) {
  return prisma.aiSkill.create({
    data: {
      name: opts.name ?? `skill-${uniq()}`,
      description: 'Integration test skill',
      skill_content: opts.content ?? '# Test skill\n\nWrite the failing test first.',
      compatible_clients: opts.clients ?? ['claude_desktop', 'cursor', 'cline', 'antigravity'],
      is_verified: opts.verified ?? true,
      is_deleted: opts.deleted ?? false,
      submitted_by: owner.user_id,
    },
  });
}

export async function makePendingReview(owner: TestUser, item_type: 'server' | 'skill', item_id: string, flagged = false) {
  return prisma.submissionReview.create({
    data: { item_type, item_id, reviewer_id: owner.user_id, status: 'pending', flagged_by_scan: flagged, review_notes: 'queued' },
  });
}

export const NIL_UUID = '00000000-0000-4000-8000-000000000000';
