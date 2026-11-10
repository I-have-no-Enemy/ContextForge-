import dotenv from 'dotenv';
import { resolve } from 'node:path';

// Import this module first. ESM hoists imports, so calling dotenv.config() in the
// body of server.ts runs after every other module has already been evaluated.
// Looks in backend/.env, then the monorepo root .env (README tells users to put it there).
dotenv.config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')] });
