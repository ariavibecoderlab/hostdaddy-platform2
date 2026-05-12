import Link from 'next/link';

/**
 * Floating "Contact us" pill. Phase 7 will replace this with the
 * Tawk.to widget; for now it routes to /help so the surface exists.
 */
export function SupportChat() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-end px-5">
      <Link
        href="/help"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-lg shadow-navy-900/10 transition-all hover:-translate-y-0.5 hover:border-electric-300 hover:text-electric-700"
        aria-label="Open support — Contact us"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-electric-500"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Contact us
      </Link>
    </div>
  );
}
