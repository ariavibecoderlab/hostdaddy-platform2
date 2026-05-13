/**
 * @hostdaddy/db — D1 + Drizzle ORM client.
 *
 * Usage in a Worker:
 *   import { createDb } from '@hostdaddy/db';
 *   const db = createDb(env.DB);
 *   const user = await db.select().from(customers).where(eq(customers.email, email));
 */

import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type HostDaddyDb = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): HostDaddyDb {
  return drizzle(d1, { schema });
}

export * from './schema';
export * from './plans';
export { schema };

/** Re-export convenience operators for callers. */
export { eq, and, or, not, sql, asc, desc, gt, gte, lt, lte, inArray, isNull, isNotNull } from 'drizzle-orm';
