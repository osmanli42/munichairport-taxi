import type { Metadata } from 'next';
import '../globals.css';
import { Inter } from 'next/font/google';
import PortalIntlProvider from '@/components/portal/PortalIntlProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Firmenkundenportal – Flughafen München Taxi',
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <PortalIntlProvider>{children}</PortalIntlProvider>
      </body>
    </html>
  );
}
