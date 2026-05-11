/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hostdaddy/ui', '@hostdaddy/cloudflare', '@hostdaddy/db', '@hostdaddy/stripe'],
  experimental: {
    typedRoutes: true,
  },
  // Cloudflare Pages requires standalone output for SSR routes; static for the rest.
  // We'll switch this on once we wire up the @cloudflare/next-on-pages adapter.
  // output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'imagedelivery.net' },
      { protocol: 'https', hostname: 'r2.hostdaddy.ai' },
    ],
  },
};

export default nextConfig;
