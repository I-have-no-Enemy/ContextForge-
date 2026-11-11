import { testDatabaseUrl } from './testDb.js';

// Runs in every test worker before any test file imports src/config/prisma.ts.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
