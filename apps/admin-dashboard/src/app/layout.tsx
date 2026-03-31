import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Public_Sans } from 'next/font/google';
import AdminProviders from '@/components/AdminProviders';
import './globals.css';

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-admin-body',
});

const displayFont = Public_Sans({
  subsets: ['latin'],
  variable: '--font-admin-display',
});

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | SaaS Blog Admin' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
