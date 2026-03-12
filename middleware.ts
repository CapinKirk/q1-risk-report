import { getToken } from 'next-auth/jwt';
import { NextResponse, NextRequest } from 'next/server';

// Test bypass for E2E testing - check for specific header
const TEST_BYPASS_HEADER = 'x-playwright-test';
const TEST_BYPASS_VALUE = process.env.PLAYWRIGHT_TEST_SECRET || 'e2e-test-bypass-2026';

export default async function middleware(req: NextRequest) {
  // Allow test bypass for E2E testing
  if (req.headers.get(TEST_BYPASS_HEADER) === TEST_BYPASS_VALUE) {
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
    signInUrl.searchParams.set('callbackUrl', req.url);
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
