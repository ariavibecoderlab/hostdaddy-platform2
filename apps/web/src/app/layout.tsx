import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@hostdaddy/ui/styles.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'HostDaddy.app — Domains, hosting, and AI-built sites. Built for growth.',
    template: '%s · HostDaddy.app',
  },
  description:
    'Register domains, host websites, and grow your business — all in one place. Built on Cloudflare for speed and reliability. Halal & trusted. Fair renewal pricing forever.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://hostdaddy.app'),
  openGraph: {
    type: 'website',
    siteName: 'HostDaddy.app',
    title: 'HostDaddy.app — Your Domain. Your Brand. Your Growth.',
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
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-navy-900 antialiased">
        {children}
      </body>
    </html>
  );
}
