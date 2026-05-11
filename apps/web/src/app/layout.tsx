import type { Metadata, Viewport } from 'next';
import '@hostdaddy/ui/styles.css';

export const metadata: Metadata = {
  title: {
    default: 'HostDaddy.ai — Your Domain. Your Brand. Your Growth.',
    template: '%s · HostDaddy.ai',
  },
  description:
    'Register domains, host websites, and grow your business — all in one place. Built on Cloudflare for speed and reliability. Halal & trusted.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://hostdaddy.ai',
  ),
  openGraph: {
    type: 'website',
    siteName: 'HostDaddy.ai',
    title: 'HostDaddy.ai — Your Domain. Your Brand. Your Growth.',
    description:
      'Register domains, host websites, and grow your business — all in one place.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A1628',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-navy-900 antialiased">
        {children}
      </body>
    </html>
  );
}
