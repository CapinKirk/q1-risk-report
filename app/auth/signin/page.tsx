'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <h1>Q1 2026 Risk Report</h1>
          <p>Sign in with your company Google account</p>
        </div>

        {error && (
          <div className="signin-error">
            {error === 'AccessDenied' ? (
              <>
                <strong>Access Denied</strong>
                <p>Only @pointofrental.com and @record360.com email addresses are allowed.</p>
              </>
            ) : (
              <>
                <strong>Authentication Error</strong>
                <p>An error occurred during sign in. Please try again.</p>
              </>
            )}
          </div>
        )}

        <button
          className="signin-button"
          onClick={() => signIn('google', { callbackUrl })}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" className="google-icon">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <div className="signin-footer">
          <p>Authorized for:</p>
          <ul>
            <li>@pointofrental.com</li>
            <li>@record360.com</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .signin-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
        }

        .signin-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .signin-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .signin-header h1 {
          font-size: 24px;
          color: #1a1a2e;
          margin-bottom: 8px;
        }

        .signin-header p {
          color: #666;
          font-size: 14px;
        }

        .signin-error {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          color: #721c24;
        }

        .signin-error strong {
          display: block;
          margin-bottom: 5px;
        }

        .signin-error p {
          margin: 0;
          font-size: 13px;
        }

        .signin-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 20px;
          font-size: 16px;
          font-weight: 500;
          color: #333;
          background: white;
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .signin-button:hover {
          border-color: #4285F4;
          background: #f8f9fa;
        }

        .google-icon {
          flex-shrink: 0;
        }

        .signin-footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          color: #888;
          font-size: 12px;
        }

        .signin-footer p {
          margin-bottom: 8px;
        }

        .signin-footer ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .signin-footer li {
          display: inline;
          margin: 0 8px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
