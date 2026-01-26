import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import SalesforceProvider from 'next-auth/providers/salesforce';

// Extend session types to include Salesforce tokens
declare module 'next-auth' {
  interface Session {
    user: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
    salesforce?: {
      accessToken: string;
      instanceUrl: string;
      refreshToken?: string;
      expiresAt?: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    email?: string;
    salesforce?: {
      accessToken: string;
      instanceUrl: string;
      refreshToken?: string;
      expiresAt?: number;
    };
  }
}

// Allowed email domains
const ALLOWED_DOMAINS = ['pointofrental.com', 'record360.com'];

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

// Salesforce OAuth configuration
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_LOGIN_URL || 'https://por.my.salesforce.com';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Salesforce provider for data enrichment (optional secondary auth)
    ...(SALESFORCE_CLIENT_ID && SALESFORCE_CLIENT_SECRET ? [
      SalesforceProvider({
        clientId: SALESFORCE_CLIENT_ID,
        clientSecret: SALESFORCE_CLIENT_SECRET,
        authorization: {
          url: `${SALESFORCE_INSTANCE_URL}/services/oauth2/authorize`,
          params: {
            scope: 'openid api refresh_token',
          },
        },
        token: `${SALESFORCE_INSTANCE_URL}/services/oauth2/token`,
        userinfo: `${SALESFORCE_INSTANCE_URL}/services/oauth2/userinfo`,
      }),
    ] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Salesforce OAuth, store tokens but don't block sign-in
      if (account?.provider === 'salesforce') {
        // SF sign-in is for linking, not primary auth
        // We'll handle token storage in the jwt callback
        return true;
      }

      // For Google (primary auth), check email domain
      if (!isAllowedEmail(user.email)) {
        console.log(`Access denied for email: ${user.email}`);
        return false;
      }
      return true;
    },
    async session({ session, token }) {
      // Add user info to session
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      // Add Salesforce tokens if available
      if (token.salesforce) {
        session.salesforce = token.salesforce;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email || undefined;
      }

      // Store Salesforce tokens when user links their SF account
      if (account?.provider === 'salesforce' && account.access_token) {
        token.salesforce = {
          accessToken: account.access_token,
          instanceUrl: SALESFORCE_INSTANCE_URL,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : undefined,
        };
        console.log('Salesforce tokens stored in session');
      }

      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
};

/**
 * Check if user has Salesforce connection in their session
 */
export function hasSalesforceConnection(session: any): boolean {
  return !!(session?.salesforce?.accessToken);
}

/**
 * Get Salesforce tokens from session (if available)
 */
export function getSalesforceTokens(session: any): { accessToken: string; instanceUrl: string } | null {
  if (!session?.salesforce?.accessToken) {
    return null;
  }
  return {
    accessToken: session.salesforce.accessToken,
    instanceUrl: session.salesforce.instanceUrl,
  };
}
