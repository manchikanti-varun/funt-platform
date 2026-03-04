import type { Metadata } from 'next';
import { Archivo_Black } from 'next/font/google';
import './globals.css';

const FONT_ARCHIVO_BLACK = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-brand-learn" });

export const metadata: Metadata = {
  title: 'FUNT LEARN',
  description: 'FUNT LEARN – FUNT Robotics Academy LMS Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={FONT_ARCHIVO_BLACK.variable}>{children}</body>
    </html>
  );
}
