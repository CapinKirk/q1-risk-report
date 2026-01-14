import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Allowed email domains
const ALLOWED_DOMAINS = ['pointofrental.com', 'record360.com'];

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow emails from approved domains
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
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
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
