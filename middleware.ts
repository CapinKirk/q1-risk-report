import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // User is authenticated, allow the request
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
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
    '/((?!api|auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
