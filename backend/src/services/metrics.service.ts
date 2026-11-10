import { prisma } from '../config/prisma.js';

type LifecycleRow = { is_verified: boolean; is_deleted: boolean; _count: { _all: number } };

function lifecycle(rows: LifecycleRow[]) {
  const out = { live: 0, unverified: 0, deleted: 0 };
  for (const r of rows) {
    if (r.is_deleted) out.deleted += r._count._all;
    else if (r.is_verified) out.live += r._count._all;
    else out.unverified += r._count._all;
  }
  return out;
}

/** Admin dashboard numbers. Small grouped COUNTs; fine at registry scale. */
export async function getRegistryMetrics() {
  const lifecycleArgs = { by: ['is_verified', 'is_deleted'] as const, _count: { _all: true } as const };
  const topArgs = { where: { is_verified: true, is_deleted: false }, orderBy: { downloads_count: 'desc' as const }, take: 5 };

  const [users, servers, skills, reviews, configs, topServers, topSkills] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.mcpServer.groupBy(lifecycleArgs as any),
    prisma.aiSkill.groupBy(lifecycleArgs as any),
    prisma.submissionReview.groupBy({ by: ['status', 'flagged_by_scan'], _count: { _all: true } }),
    prisma.clientConfig.groupBy({ by: ['client_type'], _count: { _all: true } }),
    prisma.mcpServer.findMany({ ...topArgs, select: { server_id: true, name: true, downloads_count: true, github_stars: true } }),
    prisma.aiSkill.findMany({ ...topArgs, select: { skill_id: true, name: true, downloads_count: true } }),
  ]);

  const byRole: Record<string, number> = {};
  for (const u of users) byRole[u.role] = u._count._all;

  const queue = { pending: 0, flagged_pending: 0, approved: 0, rejected: 0 };
  for (const r of reviews) {
    queue[r.status] += r._count._all;
    if (r.status === 'pending' && r.flagged_by_scan) queue.flagged_pending += r._count._all;
  }

  const byClient: Record<string, number> = {};
  for (const c of configs) byClient[c.client_type] = c._count._all;

  return {
    users: { total: Object.values(byRole).reduce((a, b) => a + b, 0), by_role: byRole },
    servers: lifecycle(servers as unknown as LifecycleRow[]),
    skills: lifecycle(skills as unknown as LifecycleRow[]),
    queue,
    configs: { total: Object.values(byClient).reduce((a, b) => a + b, 0), by_client: byClient },
    top_servers: topServers.map((s) => ({ ...s, id: s.server_id })),
    top_skills: topSkills.map((s) => ({ ...s, id: s.skill_id })),
  };
}
