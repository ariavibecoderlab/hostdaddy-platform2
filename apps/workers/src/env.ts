/**
 * Strongly-typed Worker environment + Hono context variables.
 * Anything in wrangler.toml `[vars]` or registered as a secret should appear in Env.
 * Anything attached to a request (auth user, session id) goes in Variables.
 */

export interface Env {
  // Bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: R2Bucket; // Sites-module media library

  // Vars
  NODE_ENV: 'development' | 'production';
  APP_URL: string;
  MEDIA_PUBLIC_BASE_URL?: string; // base URL where R2 objects are publicly served
  AI_MODEL?: string; // default model id for the AI build agent

  // Secrets
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  /** Cloudflare Zone ID for the SaaS parent zone (hostdaddy.app). Used by CF-for-SaaS Custom Hostnames. */
  CF_SAAS_ZONE_ID: string;
  /** CNAME target shown to customers when attaching a BYO domain. Defaults to 'hostdaddy.app'. */
  CF_SAAS_CNAME_TARGET?: string;
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  // Sites module
  ANTHROPIC_API_KEY?: string; // optional — if absent, AI agent runs in mock mode
  TURNSTILE_SECRET?: string;  // optional — form submissions fail-open if absent
  // Stripe Price IDs (one per plan × cycle)
  STRIPE_PRICE_STARTER_MONTHLY?: string;
  STRIPE_PRICE_STARTER_YEARLY?: string;
  STRIPE_PRICE_BUSINESS_MONTHLY?: string;
  STRIPE_PRICE_BUSINESS_YEARLY?: string;
  STRIPE_PRICE_AGENCY_MONTHLY?: string;
  STRIPE_PRICE_AGENCY_YEARLY?: string;
  STRIPE_PRICE_BB_MONTHLY?: string;
  STRIPE_PRICE_BB_YEARLY?: string;
  // Billplz
  BILLPLZ_API_KEY: string;
  BILLPLZ_COLLECTION_ID?: string;
  BILLPLZ_X_SIGNATURE_KEY: string;
  BILLPLZ_BASE_URL?: string; // override for sandbox testing
  // Resend
  RESEND_API_KEY: string;
  // MYNIC reseller
  EXABYTES_API_KEY?: string;
  EXABYTES_RESELLER_ID?: string;
}

/** Authenticated session info attached to the request context after middleware/auth. */
export interface AuthUser {
  customerId: string;
  email: string;
  role: 'customer' | 'franchisee' | 'agency' | 'admin';
  sessionId: string; // JWT jti — matches a row in sessions table + KV revocation key
}

/** Hono `c.env` + `c.var` typing. */
export type AppBindings = {
  Bindings: Env;
  Variables: {
    user?: AuthUser;
  };
};
