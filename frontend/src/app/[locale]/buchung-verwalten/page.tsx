import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ManageBookingClient from './ManageBookingClient';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.flughafen-muenchen.taxi';
  const path = '/buchung-verwalten';
  return {
    title: t('manage_booking_title'),
    description: t('manage_booking_description'),
    alternates: {
      canonical: locale === 'de' ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`,
      languages: {
        de: `${baseUrl}${path}`,
        en: `${baseUrl}/en${path}`,
        tr: `${baseUrl}/tr${path}`,
      },
    },
    robots: { index: false, follow: true },
  };
}

export default function ManageBookingPage() {
  return <ManageBookingClient />;
}
