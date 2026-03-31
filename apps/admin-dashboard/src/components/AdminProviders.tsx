'use client';

import { Toaster } from 'react-hot-toast';

export default function AdminProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3600,
          style: {
            background: '#16232d',
            color: '#fff8ef',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 16px 40px rgba(19, 28, 34, 0.26)',
          },
          success: {
            iconTheme: {
              primary: '#0f766e',
              secondary: '#f7fffd',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#fff7f7',
            },
          },
        }}
      />
    </>
  );
}
