import '../loadEnv.js';

/**
 * Integration tests run against a real PostgreSQL, in their own schema so they
 * never touch application data in `public`. Override with TEST_DATABASE_URL.
 */
export const TEST_SCHEMA = 'ctxforge_test';

export function testDatabaseUrl(): string {
  const raw = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('Integration tests need DATABASE_URL (or TEST_DATABASE_URL) in the env file.');
  }
  const url = new URL(raw);
  url.searchParams.set('schema', TEST_SCHEMA);
  // Supabase pooler: keep one connection per worker so TRUNCATE between tests is not racing.
  url.searchParams.set('connection_limit', url.searchParams.get('connection_limit') ?? '5');
  if (url.searchParams.get('schema') !== TEST_SCHEMA) throw new Error('Refusing to run tests outside the test schema.');
  return url.toString();
}

export const TABLES = ['submission_reviews', 'client_configs', 'tool_definitions', 'mcp_servers', 'ai_skills', 'users'];
