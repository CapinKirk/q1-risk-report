'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, { title: string; message: string }> = {
    AccessDenied: {
      title: 'Access Denied',
      message: 'Your email domain is not authorized. Only @pointofrental.com and @record360.com email addresses can access this application.',
    },
    Configuration: {
      title: 'Configuration Error',
      message: 'There is a problem with the server configuration. Please contact the administrator.',
    },
    Verification: {
      title: 'Verification Error',
      message: 'The verification token has expired or has already been used.',
    },
    Default: {
      title: 'Authentication Error',
      message: 'An unexpected error occurred during authentication. Please try again.',
    },
  };

  const { title, message } = errorMessages[error || ''] || errorMessages.Default;

  return (
    <div className="error-container">
      <div className="error-card">
        <div className="error-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#dc3545">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>

        <h1>{title}</h1>
        <p>{message}</p>

        <Link href="/auth/signin" className="retry-button">
          Try Again
        </Link>

        <div className="help-text">
          <p>Need access? Contact your IT administrator.</p>
        </div>
      </div>

      <style jsx>{`
        .error-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
        }

        .error-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .error-icon {
          margin-bottom: 20px;
        }

        h1 {
          font-size: 24px;
          color: #dc3545;
          margin-bottom: 15px;
        }

        p {
          color: #666;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 25px;
        }

        .retry-button {
          display: inline-block;
          padding: 12px 30px;
          background: #1a1a2e;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: background 0.2s ease;
        }

        .retry-button:hover {
          background: #16213e;
        }

        .help-text {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .help-text p {
          margin: 0;
          font-size: 12px;
          color: #888;
        }
      `}</style>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
