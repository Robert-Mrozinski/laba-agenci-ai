import type { Metadata } from 'next';
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
        <Navigation />
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}
