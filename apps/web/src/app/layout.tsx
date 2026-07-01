import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FotoSposi',
  description: 'La piattaforma per il tuo matrimonio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
