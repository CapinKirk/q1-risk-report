import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Q1 2026 Risk Report',
  description: 'Consolidated Q1 2026 Bookings Risk Analysis Report',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
