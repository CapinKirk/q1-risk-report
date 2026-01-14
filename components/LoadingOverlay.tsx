'use client';

import { useState, useEffect } from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

const LOADING_JOKES = [
  "Convincing the data to cooperate...",
  "Teaching spreadsheets to do backflips...",
  "Bribing the BigQuery hamsters with extra seeds...",
  "Politely asking the servers to hurry up...",
  "Converting coffee into data insights...",
  "Untangling the neural networks...",
  "Downloading more RAM from the cloud...",
  "Asking the data very nicely to load faster...",
  "Performing ancient SQL rituals...",
  "Checking if the data is just hiding...",
  "Rounding up the stray bytes...",
  "Negotiating with the database union...",
  "Waking up the sleeping queries...",
  "Feeding the algorithms some treats...",
  "Training carrier pigeons to deliver packets...",
  "Inflating the data balloons...",
  "Herding digital cats...",
  "Consulting the Oracle (the database, not the company)...",
  "Warming up the data engines...",
  "Teaching old data new tricks...",
  "Spinning up the hamster wheels...",
  "Summoning the data wizards...",
  "Defragmenting the cloud (it is just rain now)...",
  "Counting all the ones and zeros...",
  "Reminding the servers why they exist...",
  "Asking ChatGPT for motivation...",
  "Making the loading bar feel important...",
  "Reticulating splines...",
  "Reversing the entropy...",
  "Compiling the excuses...",
  "Debugging the bugs debugging the bugs...",
  "Crunching very large numbers...",
  "Fetching data from the data store (it was on sale)...",
  "Doing the data shuffle dance...",
  "Building pivot tables with our bare hands...",
  "Promising the data we will format it nicely...",
];

export default function LoadingOverlay({ isLoading, message }: LoadingOverlayProps) {
  const [currentJoke, setCurrentJoke] = useState(LOADING_JOKES[0]);
  const [jokeIndex, setJokeIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) return;

    // Change joke every 3 seconds
    const interval = setInterval(() => {
      setJokeIndex((prev) => {
        const next = (prev + 1) % LOADING_JOKES.length;
        setCurrentJoke(LOADING_JOKES[next]);
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="spinner-container">
          <div className="spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-dot"></div>
          </div>
        </div>
        <h2 className="loading-title">Refreshing Data</h2>
        <p className="loading-joke">{currentJoke}</p>
        {message && <p className="loading-message">{message}</p>}
        <div className="progress-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>

      <style jsx>{`
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }

        .loading-content {
          text-align: center;
          color: white;
          max-width: 400px;
          padding: 40px;
        }

        .spinner-container {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
        }

        .spinner {
          position: relative;
          width: 80px;
          height: 80px;
        }

        .spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 3px solid transparent;
        }

        .spinner-ring:nth-child(1) {
          border-top-color: #3b82f6;
          animation: spin 1.5s linear infinite;
        }

        .spinner-ring:nth-child(2) {
          border-right-color: #10b981;
          animation: spin 2s linear infinite reverse;
        }

        .spinner-ring:nth-child(3) {
          border-bottom-color: #f59e0b;
          animation: spin 2.5s linear infinite;
        }

        .spinner-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.5; }
        }

        .loading-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 16px 0;
          background: linear-gradient(90deg, #3b82f6, #10b981, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .loading-joke {
          font-size: 1rem;
          color: #a1a1aa;
          margin: 0 0 20px 0;
          min-height: 48px;
          animation: fadeInOut 3s ease-in-out infinite;
        }

        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }

        .loading-message {
          font-size: 0.875rem;
          color: #71717a;
          margin: 0;
        }

        .progress-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
        }

        .dot {
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .dot:nth-child(1) { animation-delay: 0s; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
