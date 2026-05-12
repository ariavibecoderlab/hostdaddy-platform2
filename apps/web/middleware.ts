import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js middleware.
 *
 * Lightweight: just checks whether the auth cookie *exists* and bounces
 * unauthenticated requests to /login?next=. Actual JWT verification happens
 * in the Workers API on every protected fetch, so we keep this fast.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = pathname.startsWith('/dashboard');
  if (!isProtected) return NextResponse.next();

  const sessionCookie = req.cookies.get('hd_session');
  if (sessionCookie?.value) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
