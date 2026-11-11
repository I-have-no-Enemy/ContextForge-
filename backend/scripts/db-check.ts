// Connectivity and index check against DATABASE_URL. Prints shape only: never host, user or password.
import '../src/loadEnv.js';
import { PrismaClient } from '@prisma/client';

const REQUIRED_INDEXES = [
  'idx_mcp_servers_verified',
  'idx_mcp_servers_submitted_by',
  'idx_ai_skills_verified',
  'idx_ai_skills_submitted_by',
  'idx_tool_server_id',
  'idx_tool_input_schema',
  'idx_client_configs_user_id',
  'idx_client_config_servers',
  'idx_client_config_skills',
  'idx_skills_tags',
  'idx_submission_reviews_pending',
  'idx_submission_reviews_item',
];

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set (root or backend env file).');
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  console.log(`database: ${local ? 'LOCAL' : 'remote'} host, port ${url.port || 5432}, schema ${url.searchParams.get('schema') ?? 'public'}`);

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      select indexname from pg_indexes where schemaname = current_schema()`;
    const have = new Set(rows.map((r) => r.indexname));
    const missing = REQUIRED_INDEXES.filter((i) => !have.has(i));
    console.log(`connected; ${REQUIRED_INDEXES.length - missing.length}/${REQUIRED_INDEXES.length} required indexes present`);
    if (missing.length) {
      console.error(`missing: ${missing.join(', ')}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`db check failed: ${String(e.message).split('\n').filter(Boolean).pop()}`);
  process.exit(1);
});
