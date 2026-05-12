/**
 * Strongly-typed Worker environment + Hono context variables.
 * Anything in wrangler.toml `[vars]` or registered as a secret should appear in Env.
 * Anything attached to a request (auth user, session id) goes in Variables.
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
