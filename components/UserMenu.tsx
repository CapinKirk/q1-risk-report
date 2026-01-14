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
          background: #f8f9fa;
          border-radius: 4px;
          border: 1px solid #ddd;
          font-size: 11px;
        }

        .user-email {
          color: #666;
        }

        .signout-btn {
          padding: 4px 10px;
          font-size: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: white;
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
