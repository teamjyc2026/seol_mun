/**
 * Loads .env.local before any module that reads process.env at import time.
 * Must be the FIRST import of every script entrypoint (ESM imports are
 * hoisted, so an inline loadEnvFile call in the entrypoint runs too late).
 */
import path from 'node:path';

process.loadEnvFile(path.join(process.cwd(), '.env.local'));
