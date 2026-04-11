import type { Metadata } from 'next';
import './globals.css';
import { LegacySessionMigration } from '@/components/LegacySessionMigration';

export const metadata: Metadata = {
  title: 'FUNT Admin',
  description: 'FUNT Robotics Academy – Admin Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LegacySessionMigration />
        {children}
      </body>
    </html>
  );
}
