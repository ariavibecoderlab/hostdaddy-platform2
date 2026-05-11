/**
 * /domains — Phase 1 endpoints.
 *
 * Phase 1: availability check (no auth required, used by homepage search bar).
 * Phase 3: registration, transfer, DNS — all gated behind auth.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createCloudflare, SUPPORTED_TLDS, type SupportedTld } from '@hostdaddy/cloudflare';
import type { AppBindings } from '../env.js';

export const domainsRoute = new Hono<AppBindings>();

const checkSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/i, 'Invalid domain syntax'),
});

interface AvailabilityResult {
  domain: string;
  tld: SupportedTld;
  available: boolean;
  price_rm: number;
  renewal_rm: number;
  registrar: 'cloudflare' | 'mynic';
}

/**
 * GET /domains/check?q=mybrand
 * Returns availability + price across all supported TLDs.
 */
domainsRoute.get('/check', async (c) => {
  const parse = checkSchema.safeParse({ query: c.req.query('q') });
  if (!parse.success) {
    return c.json({ error: 'Invalid query', details: parse.error.flatten() }, 400);
  }
  const baseQuery = parse.data.query.toLowerCase();
  // Strip a leading TLD if user typed "mybrand.com"
  const justName = baseQuery.split('.')[0];
  if (!justName) {
    return c.json({ error: 'Invalid query' }, 400);
  }

  const cf = createCloudflare({
    accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: c.env.CLOUDFLARE_API_TOKEN,
  });

  const results: AvailabilityResult[] = [];

  for (const tld of SUPPORTED_TLDS) {
    const fullDomain = `${justName}.${tld.tld}`;
    let available = false;
    try {
      if (tld.registrar === 'cloudflare') {
        const lookup = await cf.registrar.checkAvailability(fullDomain);
        available = !!lookup?.available;
      } else {
        // .my via MYNIC reseller — stubbed until Exabytes contract is signed.
        available = false;
      }
    } catch (err) {
      console.warn(`[domains/check] ${fullDomain} lookup failed`, err);
      available = false;
    }
    results.push({
      domain: fullDomain,
      tld: tld.tld,
      available,
      price_rm: tld.price_rm,
      renewal_rm: tld.renewal_rm,
      registrar: tld.registrar,
    });
  }

  return c.json({ query: justName, results });
});
