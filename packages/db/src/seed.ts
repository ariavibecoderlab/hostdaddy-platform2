/**
 * Seed script for local development.
 *
 * Run against a local D1 instance:
 *   pnpm --filter @hostdaddy/db migrate:local
 *   pnpm --filter @hostdaddy/db seed
 *
 * For production, intentionally NO-OP — seed data must be inserted manually.
 */

import { randomUUID } from 'node:crypto';

const SEED_DATA = {
  admin: {
    id: randomUUID(),
    email: 'admin@hostdaddy.app',
    name: 'HostDaddy Admin',
    role: 'admin' as const,
    country: 'MY',
    // password: 'changeme123' — hash with bcrypt at runtime, not stored here.
  },
  brainyBunchFranchisee: {
    id: randomUUID(),
    email: 'kl01@brainybunch.edu.my',
    name: 'BB KL01 Principal',
    role: 'franchisee' as const,
    franchise_code: 'BRAINYBUNCH-KL01',
    country: 'MY',
  },
  testCustomer: {
    id: randomUUID(),
    email: 'test@example.my',
    name: 'Test Customer',
    role: 'customer' as const,
    country: 'MY',
  },
};

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production. Set NODE_ENV != production.');
  process.exit(1);
}

console.log('───────────────────────────────────────────────────────────');
console.log('HostDaddy.app seed data plan');
console.log('───────────────────────────────────────────────────────────');
console.log(JSON.stringify(SEED_DATA, null, 2));
console.log('');
console.log('TODO: run inserts via wrangler d1 execute once env wiring is done.');
console.log('Once Phase 2 ships auth, this script will:');
console.log('  1. Hash passwords with bcrypt');
console.log('  2. Insert customers + sample domain + hosting plan + site');
console.log('  3. Print sample login credentials');
