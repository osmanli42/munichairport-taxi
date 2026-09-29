import type { Metadata, Viewport } from 'next';

// Driver app + single-ride driver page: installable (home screen), never indexed.
export const metadata: Metadata = {
  title: 'Fahrer-App · Flughafen München Taxi',
  manifest: '/fahrer.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'FMT Fahrer', statusBarStyle: 'black-translucent' },
  icons: { apple: '/fahrer-icon-180.png' },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function FahrerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
