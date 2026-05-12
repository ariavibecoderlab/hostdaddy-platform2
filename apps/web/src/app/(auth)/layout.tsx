import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-900">
      <div className="absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(26,86,219,0.30), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.30), transparent 55%), linear-gradient(135deg, #0A1628 0%, #050B16 60%, #0A1628 100%)',
          }}
        />
      </div>

      <header className="relative z-10">
        <div className="container-page flex h-16 items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base font-semibold text-white"
          >
            <span
              className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500"
              aria-hidden
            />
            HostDaddy<span className="text-cyan-400">.app</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
