import { getToken } from 'next-auth/jwt';
import { NextResponse, NextRequest } from 'next/server';

// Test bypass for E2E testing - only enabled when env var is explicitly set
const TEST_BYPASS_HEADER = 'x-playwright-test';
const TEST_BYPASS_VALUE = process.env.PLAYWRIGHT_TEST_SECRET; // No fallback — fail closed

export default async function middleware(req: NextRequest) {
  // Allow test bypass for E2E testing (only if PLAYWRIGHT_TEST_SECRET is configured)
  if (TEST_BYPASS_VALUE && req.headers.get(TEST_BYPASS_HEADER) === TEST_BYPASS_VALUE) {
    return NextResponse.next();
  }

  // Check for valid session token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // API routes: return 401 JSON (not a redirect)
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    // Page routes: redirect to sign-in
    const signInUrl = new URL('/auth/signin', req.url);
    const rawCallback = req.nextUrl.pathname + req.nextUrl.search;
    const safeCallback = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/';
    signInUrl.searchParams.set('callbackUrl', safeCallback);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

// Protect all routes except NextAuth routes and static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes only)
     * - auth (auth pages)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files
     */
    '/((?!api/auth|auth|_next/static|_next/image|favicon|icon).*)',
  ],
};
