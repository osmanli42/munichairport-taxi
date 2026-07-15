'use client';

import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

// Client-side provider so shared components using useLocale() work under /portal
// (outside the [locale] segment). Rendering it from a server layout would trigger
// next-intl's request-config resolution and 404 because the intl middleware
// excludes /portal.
export default function PortalIntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="de" messages={{}}>
      {children}
    </NextIntlClientProvider>
  );
}
