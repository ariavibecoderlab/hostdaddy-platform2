/**
 * Resend transactional email wrapper.
 *
 * Phase 2 Day 4.2 will swap the inline templates here for proper React Email
 * components. For now, simple HTML strings keep the dependency surface tiny.
 *
 * In dev (no RESEND_API_KEY), sends are logged to the console instead so the
 * register/forgot flows work without external secrets configured.
 */

import { renderEmail, type EmailTemplate, type EmailTemplateData } from '../emails/render';

const RESEND_BASE = 'https://api.resend.com';

export interface SendEmailInput<T extends EmailTemplate> {
  to: string;
  template: T;
  data: EmailTemplateData[T];
  /** Override default From for testing. */
  from?: string;
}

export async function sendEmail<T extends EmailTemplate>(
  env: {
    RESEND_API_KEY: string;
    NODE_ENV: 'development' | 'production';
    APP_URL: string;
  },
  input: SendEmailInput<T>,
): Promise<{ id: string | null; mocked: boolean }> {
  const { subject, html, text } = renderEmail(input.template, input.data, {
    appUrl: env.APP_URL,
  });

  const from = input.from ?? 'HostDaddy.app <hello@hostdaddy.app>';

  // Dev fallback: log instead of calling Resend.
  if (!env.RESEND_API_KEY || env.NODE_ENV === 'development') {
    console.log('[email:mock]', {
      from,
      to: input.to,
      subject,
      template: input.template,
      preview: text.slice(0, 240),
    });
    return { id: null, mocked: true };
  }

  const res = await fetch(`${RESEND_BASE}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: input.to, subject, html, text }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${errBody}`);
  }
  const body = (await res.json()) as { id?: string };
  return { id: body.id ?? null, mocked: false };
}
