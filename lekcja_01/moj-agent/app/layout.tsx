import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppFrame, AuthProvider } from './components/AuthProvider';
import { Navigation } from './components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'Costa Broker',
  description: 'Doradca nieruchomości Costa Broker w Hiszpanii.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <Suspense
          fallback={
            <main className="auth-shell">
              <section className="auth-card">
                <h1>Costa Broker</h1>
                <p>Ładuję aplikację...</p>
              </section>
            </main>
          }
        >
          <AuthProvider>
            <Navigation />
            <AppFrame>{children}</AppFrame>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
