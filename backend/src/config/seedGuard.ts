/** Schema the test suite owns; wiping it is always safe. */
const TEST_SCHEMA = 'ctxforge_test';

/**
 * `npm run seed` deletes every row in six tables. Against anything but the test schema it must be asked
 * for explicitly, so a stray run with a production DATABASE_URL cannot erase users and imported listings.
 * The error never repeats the connection string.
 */
export function assertSeedAllowed(databaseUrl: string | undefined, argv: string[]): void {
  let schema = '';
  try {
    schema = new URL(databaseUrl ?? '').searchParams.get('schema') ?? '';
  } catch {
    /* an unparsable URL counts as "not the test schema" */
  }
  if (schema === TEST_SCHEMA || argv.includes('--confirm-wipe')) return;
  throw new Error(
    'seed deletes all users, servers, skills and reviews in the database DATABASE_URL points to. ' +
      'Re-run with --confirm-wipe if that is what you want: npm run seed --workspace=backend -- --confirm-wipe',
  );
}
