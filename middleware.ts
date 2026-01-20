import { withAuth } from 'next-auth/middleware';
import { NextResponse, NextRequest } from 'next/server';

// Test bypass for E2E testing - check for specific header
const TEST_BYPASS_HEADER = 'x-playwright-test';
const TEST_BYPASS_VALUE = process.env.PLAYWRIGHT_TEST_SECRET || 'e2e-test-bypass-2026';

function middleware(req: NextRequest) {
  // Allow test bypass for E2E testing
  const testHeader = req.headers.get(TEST_BYPASS_HEADER);
  if (testHeader === TEST_BYPASS_VALUE) {
    return NextResponse.next();
  }

  // Fall through to withAuth for normal requests
  return null;
}

export default withAuth(
  function authMiddleware(req) {
    // User is authenticated, allow the request
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check for test bypass header
        const testHeader = req.headers.get(TEST_BYPASS_HEADER);
        if (testHeader === TEST_BYPASS_VALUE) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

// Protect all routes except auth routes, api routes, and static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (all API routes - protected by their own auth)
     * - auth (auth pages)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files
     */
    '/((?!api|auth|_next/static|_next/image|favicon|icon).*)',
  ],
};
