/**
 * Strongly-typed Worker environment.
 * Anything in wrangler.toml `[vars]` or registered as a secret should appear here.
 */

export interface Env {
  // Bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: R2Bucket;

  // Vars
  NODE_ENV: 'development' | 'production';
  APP_URL: string;

  // Secrets
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  BILLPLZ_API_KEY: string;
  BILLPLZ_X_SIGNATURE_KEY: string;
  RESEND_API_KEY: string;
  EXABYTES_API_KEY?: string;
  EXABYTES_RESELLER_ID?: string;
}

/** Hono `c.env` typing helper. */
export type AppBindings = { Bindings: Env };
