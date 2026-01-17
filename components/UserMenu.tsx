'use client';

import { useSession, signOut } from 'next-auth/react';

export default function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="user-menu">
      <span className="user-email">{session.user.email}</span>
      <button
        className="signout-btn"
        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
      >
        Sign Out
      </button>

      <style jsx>{`
        .user-menu {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          border: 1px solid var(--border-primary);
          font-size: 11px;
        }

        .user-email {
          color: var(--text-secondary);
        }

        .signout-btn {
          padding: 4px 10px;
          font-size: 10px;
          border: 1px solid var(--border-primary);
          border-radius: 4px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .signout-btn:hover {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }
      `}</style>
    </div>
  );
}
