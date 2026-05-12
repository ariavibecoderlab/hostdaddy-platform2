/**
 * /me — current customer profile.
 *
 * GET    /me                → identical to /auth/me, kept here for REST parity
 * PATCH  /me                → update name, phone, company
 * (See /auth/change-password for password updates and /auth/forgot-password for resets.)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createDb, customers, auditLog, eq } from '@hostdaddy/db';
import { requireAuth } from '../middleware/auth';
import type { AppBindings } from '../env';

export const meRoute = new Hono<AppBindings>();

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
});

meRoute.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  if (!customer) return c.json({ error: 'Account not found' }, 404);
  return c.json({
    user: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      company: customer.company,
      role: customer.role,
      franchiseCode: customer.franchise_code,
    },
  });
});

meRoute.patch('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400);
  }

  const db = createDb(c.env.DB);

  const updateData: Partial<typeof customers.$inferInsert> & { updated_at: Date } = {
    updated_at: new Date(),
  };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phone !== undefined) updateData.phone = input.phone ?? null;
  if (input.company !== undefined) updateData.company = input.company ?? null;

  await db.update(customers).set(updateData).where(eq(customers.id, user.customerId));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    customer_id: user.customerId,
    actor: 'customer',
    action: 'profile.updated',
    entity_type: 'customer',
    entity_id: user.customerId,
    metadata: JSON.stringify(input),
    ip_address: c.req.header('cf-connecting-ip') ?? null,
  });

  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  return c.json({
    user: customer
      ? {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          company: customer.company,
          role: customer.role,
          franchiseCode: customer.franchise_code,
        }
      : null,
  });
});
