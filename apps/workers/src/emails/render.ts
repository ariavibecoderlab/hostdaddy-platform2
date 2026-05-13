/**
 * Email template registry. Each template renders to { subject, html, text }.
 * Keep templates inline as HTML strings — small surface, easy to preview.
 *
 * To add a new template:
 *  1. Add to EmailTemplate union below
 *  2. Add a data shape to EmailTemplateData
 *  3. Add a case in `renderEmail`
 */

export type EmailTemplate =
  | 'welcome'
  | 'receipt'
  | 'password_reset'
  | 'renewal_reminder';

export interface EmailTemplateData {
  welcome: { name: string };
  receipt: {
    name: string;
    invoiceNumber: string;
    description: string;
    amountRm: string; // pre-formatted "RM 49.00"
    paidAt: string; // pre-formatted date
  };
  password_reset: { name: string; resetUrl: string };
  renewal_reminder: {
    name: string;
    domain: string;
    expiresAt: string;
    daysUntil: number;
    renewUrl: string;
  };
}

interface RenderContext {
  appUrl: string;
}

const BRAND_NAVY = '#0A1628';
const BRAND_ELECTRIC = '#1A56DB';
const BRAND_CYAN = '#06B6D4';

function wrap(args: { previewText: string; bodyHtml: string; ctx: RenderContext }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>HostDaddy.app</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND_NAVY};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${args.previewText}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ee;">
            <tr>
              <td style="background:${BRAND_NAVY};padding:18px 28px;color:#ffffff;font-weight:600;font-size:16px;">
                <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:linear-gradient(135deg,${BRAND_ELECTRIC},${BRAND_CYAN});vertical-align:-3px;margin-right:8px;"></span>
                HostDaddy<span style="color:${BRAND_CYAN};">.app</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:15px;line-height:1.6;">
                ${args.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background:#f9fafb;padding:18px 28px;font-size:12px;color:#5f6b7c;border-top:1px solid #e6e9ee;">
                HostDaddy.app is a brand of White Unicorn Ventures Sdn Bhd.<br/>
                <a href="${args.ctx.appUrl}/help" style="color:${BRAND_ELECTRIC};text-decoration:none;">Help centre</a> · <a href="${args.ctx.appUrl}/contact" style="color:${BRAND_ELECTRIC};text-decoration:none;">Contact us</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_ELECTRIC};color:#ffffff;padding:11px 22px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateData[T],
  ctx: RenderContext,
): RenderedEmail {
  switch (template) {
    case 'welcome': {
      const d = data as EmailTemplateData['welcome'];
      const findUrl = `${ctx.appUrl}/search`;
      return {
        subject: 'Welcome to HostDaddy.app. Your digital home awaits.',
        html: wrap({
          previewText: `Welcome aboard, ${d.name}.`,
          bodyHtml: `
            <p style="margin:0 0 14px;font-size:17px;color:${BRAND_NAVY};"><strong>Hi ${d.name}, welcome aboard.</strong></p>
            <p style="margin:0 0 14px;">HostDaddy.app is the registrar + host built for Muslim entrepreneurs and Malaysian SMEs. Fair pricing, fast Cloudflare edge, halal acceptable use.</p>
            <p style="margin:0 0 22px;">Your next step: search for your first domain.</p>
            <p style="margin:0 0 22px;">${button('Find a domain', findUrl)}</p>
            <p style="margin:0;color:#5f6b7c;font-size:14px;">Need help? Hit reply, or chat with us at <a href="${ctx.appUrl}/help" style="color:${BRAND_ELECTRIC};">${ctx.appUrl.replace(/^https?:\/\//, '')}/help</a>.</p>
            <p style="margin:18px 0 0;">— Coach Fadzil &amp; the HostDaddy.app team</p>
          `,
          ctx,
        }),
        text: `Hi ${d.name}, welcome aboard.\n\nHostDaddy.app is the registrar + host built for Muslim entrepreneurs and Malaysian SMEs. Fair pricing, fast Cloudflare edge, halal acceptable use.\n\nYour next step: search for your first domain.\n${findUrl}\n\nNeed help? Hit reply or visit ${ctx.appUrl}/help.\n\n— Coach Fadzil & the HostDaddy.app team`,
      };
    }

    case 'receipt': {
      const d = data as EmailTemplateData['receipt'];
      return {
        subject: `Receipt ${d.invoiceNumber} · ${d.amountRm}`,
        html: wrap({
          previewText: `Your HostDaddy.app receipt for ${d.amountRm}.`,
          bodyHtml: `
            <p style="margin:0 0 14px;font-size:17px;color:${BRAND_NAVY};"><strong>Thanks ${d.name}, payment received.</strong></p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#5f6b7c;font-size:13px;">Invoice</td><td style="padding:8px 0;text-align:right;"><strong>${d.invoiceNumber}</strong></td></tr>
              <tr><td style="padding:8px 0;color:#5f6b7c;font-size:13px;">Description</td><td style="padding:8px 0;text-align:right;">${d.description}</td></tr>
              <tr><td style="padding:8px 0;color:#5f6b7c;font-size:13px;">Paid</td><td style="padding:8px 0;text-align:right;">${d.paidAt}</td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #e6e9ee;font-size:15px;color:${BRAND_NAVY};"><strong>Total</strong></td><td style="padding:8px 0;border-top:1px solid #e6e9ee;text-align:right;font-size:15px;"><strong>${d.amountRm}</strong></td></tr>
            </table>
            <p style="margin:0 0 18px;">View this and all invoices in your dashboard.</p>
            <p style="margin:0 0 22px;">${button('Go to dashboard', `${ctx.appUrl}/dashboard/billing`)}</p>
            <p style="margin:0;color:#5f6b7c;font-size:13px;">Receipt includes 8% SST where applicable. Need a corrected tax invoice? Reply to this email.</p>
          `,
          ctx,
        }),
        text: `Thanks ${d.name}, payment received.\n\nInvoice: ${d.invoiceNumber}\nDescription: ${d.description}\nPaid: ${d.paidAt}\nTotal: ${d.amountRm}\n\nView invoices: ${ctx.appUrl}/dashboard/billing`,
      };
    }

    case 'password_reset': {
      const d = data as EmailTemplateData['password_reset'];
      return {
        subject: 'Reset your HostDaddy.app password',
        html: wrap({
          previewText: 'Reset your HostDaddy.app password.',
          bodyHtml: `
            <p style="margin:0 0 14px;font-size:17px;color:${BRAND_NAVY};"><strong>Hi ${d.name},</strong></p>
            <p style="margin:0 0 14px;">Someone — hopefully you — requested a password reset. This link works for the next hour:</p>
            <p style="margin:0 0 22px;">${button('Reset password', d.resetUrl)}</p>
            <p style="margin:0 0 14px;color:#5f6b7c;font-size:13px;">Or paste into your browser:<br/><a href="${d.resetUrl}" style="color:${BRAND_ELECTRIC};word-break:break-all;">${d.resetUrl}</a></p>
            <p style="margin:18px 0 0;">If you didn't request this, ignore this email. Your account stays safe.</p>
          `,
          ctx,
        }),
        text: `Hi ${d.name},\n\nSomeone — hopefully you — requested a password reset. This link works for the next hour:\n\n${d.resetUrl}\n\nIf you didn't request this, ignore this email. Your account stays safe.`,
      };
    }

    case 'renewal_reminder': {
      const d = data as EmailTemplateData['renewal_reminder'];
      return {
        subject: `${d.domain} expires in ${d.daysUntil} day${d.daysUntil === 1 ? '' : 's'}`,
        html: wrap({
          previewText: `${d.domain} expires ${d.expiresAt}.`,
          bodyHtml: `
            <p style="margin:0 0 14px;font-size:17px;color:${BRAND_NAVY};"><strong>Hi ${d.name},</strong></p>
            <p style="margin:0 0 14px;"><strong>${d.domain}</strong> expires on ${d.expiresAt} — that's ${d.daysUntil} day${d.daysUntil === 1 ? '' : 's'} away.</p>
            <p style="margin:0 0 22px;">Renew now to keep your site online. Auto-renew is the safer option for the future.</p>
            <p style="margin:0 0 22px;">${button(`Renew ${d.domain}`, d.renewUrl)}</p>
          `,
          ctx,
        }),
        text: `Hi ${d.name},\n\n${d.domain} expires on ${d.expiresAt} — ${d.daysUntil} day(s) away.\n\nRenew: ${d.renewUrl}`,
      };
    }
  }
  // exhaustive check
  const _exhaustive: never = template;
  throw new Error(`Unknown template: ${String(_exhaustive)}`);
}
